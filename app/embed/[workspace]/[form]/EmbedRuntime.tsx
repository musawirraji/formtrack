"use client";

import { useEffect, useMemo, useState } from "react";

import type { FormSnapshot } from "@/domain/form/snapshot";

/**
 * Client runtime for the hosted embed page. Mirrors the vanilla
 * embed script's capture + submission logic but inside React so the
 * hosted page benefits from hydration + accessibility defaults.
 *
 * Attribution is captured once on mount from `document.referrer` and
 * `location.search`, then cached in `sessionStorage` under the same
 * key the embed script uses so the two runtimes stay consistent.
 */

const STORAGE_KEY = "__formtrack_attribution__";

interface AttributionPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  pageUrl: string;
  userAgent?: string;
}

interface Props {
  readonly snapshot: FormSnapshot;
}

export function EmbedRuntime({ snapshot }: Props) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const attribution = useMemo<AttributionPayload | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AttributionPayload;
        return { ...parsed, pageUrl: location.href };
      }
    } catch {
      // ignore
    }
    const params = new URLSearchParams(location.search);
    const payload: AttributionPayload = {
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmTerm: params.get("utm_term") ?? undefined,
      utmContent: params.get("utm_content") ?? undefined,
      fbclid: params.get("fbclid") ?? undefined,
      gclid: params.get("gclid") ?? undefined,
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
  }, []);

  useEffect(() => {
    // No-op. Exists so the `attribution` useMemo above runs on the
    // client only; we intentionally read `window` inside useMemo and
    // useEffect guarantees hydration doesn't reorder.
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!attribution) return;
    setState("submitting");
    setError(null);
    try {
      const res = await fetch(
        `/api/submissions/${encodeURIComponent(snapshot.workspaceId)}/${encodeURIComponent(snapshot.formId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values,
            attribution,
            snapshotVersion: snapshot.version,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server error (${res.status})`);
      }
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: 24,
          background: "#f3f8f4",
          border: "1px solid #cfe4d3",
          borderRadius: 10,
          color: "#204030",
        }}
      >
        {snapshot.successMessage}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: "1px solid #d6d6e0",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
        {snapshot.title}
      </h2>

      {snapshot.fields.map((field) => {
        const current = values[field.id] ?? "";
        const onText = (v: string) =>
          setValues((prev) => ({ ...prev, [field.id]: v }));
        return (
          <div
            key={field.id}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              {field.label}
              {field.required && " *"}
            </label>
            {field.helpText && (
              <small style={{ fontSize: 11, color: "#666" }}>
                {field.helpText}
              </small>
            )}
            {field.type === "long_text" ? (
              <textarea
                rows={4}
                required={field.required}
                placeholder={field.placeholder ?? ""}
                value={typeof current === "string" ? current : ""}
                onChange={(e) => onText(e.target.value)}
                style={inputStyle}
              />
            ) : field.type === "dropdown" ? (
              <select
                required={field.required}
                value={typeof current === "string" ? current : ""}
                onChange={(e) => onText(e.target.value)}
                style={inputStyle}
              >
                <option value="">
                  {field.placeholder ?? "Choose one…"}
                </option>
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === "radio" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {field.options.map((o) => (
                  <label
                    key={o}
                    style={{ display: "flex", gap: 8, fontSize: 14 }}
                  >
                    <input
                      type="radio"
                      name={field.id}
                      value={o}
                      required={field.required}
                      checked={current === o}
                      onChange={() => onText(o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : field.type === "checkbox" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {field.options.map((o) => {
                  const arr = Array.isArray(current) ? current : [];
                  const checked = arr.includes(o);
                  return (
                    <label
                      key={o}
                      style={{ display: "flex", gap: 8, fontSize: 14 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setValues((prev) => {
                            const prevArr =
                              Array.isArray(prev[field.id]) &&
                              (prev[field.id] as string[]);
                            const base = prevArr || [];
                            return {
                              ...prev,
                              [field.id]: e.target.checked
                                ? [...base, o]
                                : base.filter((x) => x !== o),
                            };
                          })
                        }
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "phone"
                      ? "tel"
                      : field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : "text"
                }
                required={field.required}
                placeholder={field.placeholder ?? ""}
                value={typeof current === "string" ? current : ""}
                onChange={(e) => onText(e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        );
      })}

      {error && <div style={{ color: "#c02648", fontSize: 13 }}>{error}</div>}

      <button
        type="submit"
        disabled={state === "submitting"}
        style={{
          padding: "12px 18px",
          background: snapshot.theme.accent,
          color: "#fff",
          border: 0,
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          cursor: state === "submitting" ? "progress" : "pointer",
        }}
      >
        {state === "submitting" ? "Sending…" : snapshot.submitButtonLabel}
      </button>
    </form>
  );
}
