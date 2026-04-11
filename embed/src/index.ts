/**
 * FormTrack embed script.
 *
 * Shipped as a single IIFE bundle (<10KB gzipped target) that
 * customers drop into their site:
 *
 *   <script src="https://cdn.formtrack.io/ft.js"
 *           data-ft-workspace="acme"
 *           data-ft-form="get-a-quote"
 *           data-ft-target="#ft-mount"
 *           defer></script>
 *
 * Responsibilities:
 *   1. Collect the raw attribution payload on page load (UTM params,
 *      referrer, click IDs, landing page) — this is the product's
 *      entire reason for existing, so it has to run BEFORE anything
 *      else strips query params.
 *   2. Fetch the published form snapshot from the FormTrack host.
 *   3. Render it into the target element using vanilla DOM — no
 *      framework, no shadow DOM, inherits the host site's font.
 *   4. POST submissions (values + attribution payload) to the
 *      submission API.
 *
 * Deliberately has zero runtime deps.
 */

interface AttributionPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmId?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  pageUrl: string;
  userAgent?: string;
}

interface SnapshotField {
  id: string;
  type:
    | "short_text"
    | "long_text"
    | "email"
    | "phone"
    | "number"
    | "dropdown"
    | "checkbox"
    | "radio"
    | "date"
    | "file";
  label: string;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  options: string[];
  stepIndex: number;
  displayOrder: number;
}

interface FormSnapshot {
  schemaVersion: 1;
  formId: string;
  workspaceId: string;
  slug: string;
  title: string;
  theme: { accent: string; font: string; corners: string };
  submitButtonLabel: string;
  successMessage: string;
  fields: SnapshotField[];
  version: number;
  publishedAt: string;
}

const STORAGE_KEY = "__formtrack_attribution__";

(function () {
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  if (!scriptTag) return;

  const host = resolveHost(scriptTag);
  const workspaceSlug = scriptTag.dataset.ftWorkspace;
  const formSlug = scriptTag.dataset.ftForm;
  const targetSelector = scriptTag.dataset.ftTarget ?? "#ft-mount";

  if (!workspaceSlug || !formSlug) {
    console.warn(
      "[FormTrack] script tag is missing data-ft-workspace or data-ft-form",
    );
    return;
  }

  // Capture attribution on first load before any SPA navigation
  // strips query params. We persist to sessionStorage so the same
  // payload survives if the user navigates around before submitting.
  const attribution = captureAttribution();

  bootstrap({
    host,
    workspaceSlug,
    formSlug,
    targetSelector,
    attribution,
  }).catch((err) => {
    console.error("[FormTrack] bootstrap failed:", err);
  });
})();

async function bootstrap(opts: {
  host: string;
  workspaceSlug: string;
  formSlug: string;
  targetSelector: string;
  attribution: AttributionPayload;
}) {
  const { host, workspaceSlug, formSlug, targetSelector, attribution } = opts;

  const target = document.querySelector<HTMLElement>(targetSelector);
  if (!target) {
    console.warn(`[FormTrack] target ${targetSelector} not found`);
    return;
  }

  target.innerHTML = `<div class="ft-loading">Loading form…</div>`;

  const res = await fetch(
    `${host}/api/embed/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(formSlug)}`,
    { method: "GET", credentials: "omit" },
  );
  if (!res.ok) {
    target.innerHTML = `<div class="ft-error">Form not available.</div>`;
    return;
  }
  const snapshot = (await res.json()) as FormSnapshot;

  render({ host, target, snapshot, attribution });
}

function render(opts: {
  host: string;
  target: HTMLElement;
  snapshot: FormSnapshot;
  attribution: AttributionPayload;
}) {
  const { host, target, snapshot, attribution } = opts;

  injectStyles(snapshot.theme.accent, snapshot.theme.corners);

  const form = document.createElement("form");
  form.className = "ft-form";
  form.setAttribute("novalidate", "");

  const heading = document.createElement("h2");
  heading.className = "ft-title";
  heading.textContent = snapshot.title;
  form.appendChild(heading);

  for (const field of snapshot.fields) {
    form.appendChild(renderField(field));
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "ft-submit";
  submit.textContent = snapshot.submitButtonLabel;
  form.appendChild(submit);

  const errorBox = document.createElement("div");
  errorBox.className = "ft-form-error";
  errorBox.setAttribute("role", "alert");
  form.appendChild(errorBox);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";
    submit.disabled = true;
    submit.textContent = "Sending…";

    try {
      const values = collectValues(form, snapshot.fields);
      const res = await fetch(
        `${host}/api/submissions/${encodeURIComponent(snapshot.workspaceId)}/${encodeURIComponent(snapshot.formId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({
            values,
            attribution,
            snapshotVersion: snapshot.version,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Server error (${res.status})`,
        );
      }

      target.innerHTML = `<div class="ft-success">${escapeHtml(
        snapshot.successMessage,
      )}</div>`;
    } catch (err) {
      errorBox.textContent =
        err instanceof Error ? err.message : "Something went wrong.";
      submit.disabled = false;
      submit.textContent = snapshot.submitButtonLabel;
    }
  });

  target.innerHTML = "";
  target.appendChild(form);
}

// ─── Field renderers ─────────────────────────────────────────
function renderField(field: SnapshotField): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "ft-field";

  const id = `ft-${field.id}`;
  const label = document.createElement("label");
  label.className = "ft-label";
  label.setAttribute("for", id);
  label.textContent = field.required ? `${field.label} *` : field.label;
  wrapper.appendChild(label);

  if (field.helpText) {
    const help = document.createElement("small");
    help.className = "ft-help";
    help.textContent = field.helpText;
    wrapper.appendChild(help);
  }

  wrapper.appendChild(buildControl(field, id));
  return wrapper;
}

function buildControl(field: SnapshotField, id: string): HTMLElement {
  switch (field.type) {
    case "long_text": {
      const t = document.createElement("textarea");
      t.id = id;
      t.name = field.id;
      t.rows = 4;
      t.className = "ft-input";
      if (field.placeholder) t.placeholder = field.placeholder;
      if (field.required) t.required = true;
      return t;
    }
    case "dropdown": {
      const s = document.createElement("select");
      s.id = id;
      s.name = field.id;
      s.className = "ft-input";
      if (field.required) s.required = true;
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = field.placeholder ?? "Choose one…";
      s.appendChild(empty);
      for (const opt of field.options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        s.appendChild(o);
      }
      return s;
    }
    case "radio":
    case "checkbox": {
      const group = document.createElement("div");
      group.className = "ft-options";
      field.options.forEach((opt, i) => {
        const row = document.createElement("label");
        row.className = "ft-option";
        const input = document.createElement("input");
        input.type = field.type === "radio" ? "radio" : "checkbox";
        input.name = field.id;
        input.value = opt;
        if (i === 0 && field.required && field.type === "radio")
          input.required = true;
        const span = document.createElement("span");
        span.textContent = opt;
        row.appendChild(input);
        row.appendChild(span);
        group.appendChild(row);
      });
      return group;
    }
    default: {
      const i = document.createElement("input");
      i.id = id;
      i.name = field.id;
      i.className = "ft-input";
      i.type = inputTypeFor(field.type);
      if (field.placeholder) i.placeholder = field.placeholder;
      if (field.required) i.required = true;
      return i;
    }
  }
}

function inputTypeFor(type: SnapshotField["type"]): string {
  switch (type) {
    case "email":
      return "email";
    case "phone":
      return "tel";
    case "number":
      return "number";
    case "date":
      return "date";
    case "file":
      return "file";
    default:
      return "text";
  }
}

function collectValues(
  form: HTMLFormElement,
  fields: SnapshotField[],
): Record<string, string | string[]> {
  const data = new FormData(form);
  const out: Record<string, string | string[]> = {};
  for (const field of fields) {
    if (field.type === "checkbox") {
      out[field.id] = data.getAll(field.id).map(String);
    } else {
      const v = data.get(field.id);
      out[field.id] = v === null ? "" : String(v);
    }
  }
  return out;
}

// ─── Attribution capture ─────────────────────────────────────
function captureAttribution(): AttributionPayload {
  // Prefer an already-captured payload (e.g. the user landed, we
  // captured UTMs, they navigated to /contact where the form lives,
  // and the SPA stripped the query string). We don't want to
  // overwrite the original attribution with "direct / untracked"
  // just because the form is on a different URL.
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as AttributionPayload;
      return { ...parsed, pageUrl: location.href };
    }
  } catch {
    // ignore quota / JSON errors
  }

  const params = new URLSearchParams(location.search);
  const get = (k: string) => params.get(k) ?? undefined;

  const payload: AttributionPayload = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmTerm: get("utm_term"),
    utmContent: get("utm_content"),
    utmId: get("utm_id"),
    fbclid: get("fbclid"),
    gclid: get("gclid"),
    referrer: document.referrer || undefined,
    landingPage: location.href,
    pageUrl: location.href,
    userAgent: navigator.userAgent,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }

  return payload;
}

// ─── Host resolution ─────────────────────────────────────────
// The script reads its own src to figure out which host to call.
// Falls back to data-ft-host for self-hosting.
function resolveHost(script: HTMLScriptElement): string {
  const override = script.dataset.ftHost;
  if (override) return override.replace(/\/$/, "");
  try {
    const url = new URL(script.src, location.href);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

// ─── Styling ─────────────────────────────────────────────────
function injectStyles(accent: string, corners: string): void {
  if (document.getElementById("ft-styles")) return;
  const radius =
    corners === "sharp" ? "2px" : corners === "pill" ? "999px" : "10px";
  const css = `
  .ft-form{font-family:inherit;display:flex;flex-direction:column;gap:14px;max-width:520px}
  .ft-title{font-size:22px;font-weight:600;margin:0 0 4px 0}
  .ft-field{display:flex;flex-direction:column;gap:6px}
  .ft-label{font-size:13px;font-weight:500;color:#333}
  .ft-help{font-size:11px;color:#666}
  .ft-input{font:inherit;padding:10px 12px;border:1px solid #d6d6e0;border-radius:${radius};background:#fff;color:#1a1a1f}
  .ft-input:focus{outline:none;border-color:${accent};box-shadow:0 0 0 3px ${accent}22}
  .ft-options{display:flex;flex-direction:column;gap:6px}
  .ft-option{display:flex;align-items:center;gap:8px;font-size:14px}
  .ft-submit{font:inherit;font-weight:600;background:${accent};color:#fff;border:0;padding:12px 18px;border-radius:${radius};cursor:pointer;margin-top:8px}
  .ft-submit:disabled{opacity:.6;cursor:progress}
  .ft-form-error{color:#c02648;font-size:13px;min-height:1em}
  .ft-success{padding:24px;background:#f3f8f4;border:1px solid #cfe4d3;border-radius:${radius};color:#204030;font-size:15px}
  .ft-loading{padding:24px;color:#666;font-size:14px}
  .ft-error{padding:24px;color:#c02648;font-size:14px}
  `;
  const style = document.createElement("style");
  style.id = "ft-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
