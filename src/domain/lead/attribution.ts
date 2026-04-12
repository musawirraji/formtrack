import type {
  AttributionChannel,
  AttributionConfidence,
  AttributionPayload,
  AttributionSource,
} from "./Lead";

/**
 * Pure attribution resolver. Takes a raw attribution payload and returns a
 * normalized AttributionSource with a plain-English explanation.
 *
 * This is the core "show business owners where their leads came from"
 * logic — kept as a pure function so it's dead-simple to unit test.
 */
export function resolveAttribution(raw: AttributionPayload): AttributionSource {
  const utmSource = raw.utmSource?.toLowerCase().trim();
  const utmMedium = raw.utmMedium?.toLowerCase().trim();
  const referrerHost = safeHost(raw.referrer);

  // 1. Explicit UTM match wins every time.
  if (utmSource || utmMedium) {
    const channel = classifyFromUtm(utmSource, utmMedium);
    const label = humanLabel(channel);
    return {
      channel,
      label,
      campaign: raw.utmCampaign ?? null,
      referrerHost,
      explanation: buildExplanation({
        channel,
        campaign: raw.utmCampaign,
        medium: utmMedium,
        source: utmSource,
        referrerHost,
      }),
      confidence: "high",
    };
  }

  // 2. Click ID without UTM — still high confidence we know the platform.
  if (raw.fbclid) {
    return {
      channel: "meta_ads",
      label: "Meta Ads",
      campaign: null,
      referrerHost,
      explanation:
        "Clicked from a Meta ad — Facebook or Instagram — but the campaign wasn't tagged. Add UTM parameters to know which campaign.",
      confidence: "medium",
    };
  }

  if (raw.gclid) {
    return {
      channel: "google_ads",
      label: "Google Ads",
      campaign: null,
      referrerHost,
      explanation:
        "Clicked from a Google ad but the campaign wasn't tagged. Add UTM parameters to know which campaign.",
      confidence: "medium",
    };
  }

  // 3. Referrer-based detection — medium confidence.
  if (referrerHost) {
    if (/google\./.test(referrerHost)) {
      return {
        channel: "google_organic",
        label: "Google (organic)",
        campaign: null,
        referrerHost,
        explanation: `Found you through a Google search. No paid ad click was recorded.`,
        confidence: "medium",
      };
    }
    if (/facebook\.|instagram\.|fb\./.test(referrerHost)) {
      return {
        channel: "meta_ads",
        label: "Meta (organic)",
        campaign: null,
        referrerHost,
        explanation: `Came from ${referrerHost}. No paid click ID — likely an organic post or story link.`,
        confidence: "medium",
      };
    }
    return {
      channel: "referral",
      label: `Referral · ${referrerHost}`,
      campaign: null,
      referrerHost,
      explanation: `Clicked a link on ${referrerHost}.`,
      confidence: "medium",
    };
  }

  // 4. No UTM, no click ID, no referrer → direct / unknown.
  return {
    channel: "direct",
    label: "Direct / Untracked",
    campaign: null,
    referrerHost: null,
    explanation:
      "Landed on your site directly — typed the URL, used a bookmark, or came from an app that strips referrer data. No source information available.",
    confidence: "low",
  };

  // ─── helpers ──────────────────────────────────────────
  function classifyFromUtm(
    source: string | undefined,
    medium: string | undefined
  ): AttributionChannel {
    if (!source && !medium) return "other";
    const s = source ?? "";
    const m = medium ?? "";
    if (s === "google" && (m === "cpc" || m === "paid")) return "google_ads";
    if (
      s === "facebook" ||
      s === "instagram" ||
      s === "meta" ||
      (m === "cpc" && raw.fbclid)
    )
      return "meta_ads";
    if (s === "google" && m === "organic") return "google_organic";
    if (m === "email" || s === "newsletter") return "email";
    if (m === "organic") return "organic";
    if (m === "referral") return "referral";
    return "other";
  }

  function humanLabel(channel: AttributionChannel): string {
    switch (channel) {
      case "meta_ads":       return "Meta Ads";
      case "google_ads":     return "Google Ads";
      case "google_organic": return "Google (organic)";
      case "organic":        return "Organic search";
      case "email":          return "Email";
      case "referral":       return "Referral";
      case "direct":         return "Direct / Untracked";
      case "other":          return "Other";
    }
  }
}

function safeHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}

function buildExplanation(input: {
  channel: AttributionChannel;
  campaign?: string;
  medium?: string;
  source?: string;
  referrerHost: string | null;
}): string {
  const { channel, campaign, medium, source, referrerHost } = input;
  const campaignBit = campaign ? ` campaign '${campaign}'` : "";
  const fromBit = referrerHost ? `, clicked from ${referrerHost}` : "";

  switch (channel) {
    case "meta_ads":
      return `From your Meta Ads${campaignBit}${fromBit}.`;
    case "google_ads":
      return `From your Google Ads${campaignBit}${fromBit}.`;
    case "google_organic":
      return `Organic Google search result${fromBit}.`;
    case "email":
      return `Clicked a link in your email${campaignBit}.`;
    case "organic":
      return `Organic traffic from ${source ?? "search"}${campaignBit}.`;
    case "referral":
      return `Referral from ${source ?? referrerHost ?? "another site"}${campaignBit}.`;
    default:
      return `Tagged source: ${source ?? "unknown"} / ${medium ?? "unknown"}${campaignBit}.`;
  }
}

/** Utility: confidence ranking for sorting. */
export const CONFIDENCE_RANK: Record<AttributionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};
