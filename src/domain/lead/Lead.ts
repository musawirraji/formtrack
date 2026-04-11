import type { WorkspaceId } from "../workspace/Workspace";
import type { FormId } from "../form/Form";

export type LeadId = string & { readonly __brand: "LeadId" };

/**
 * AttributionSource — a normalized, human-readable explanation of where a
 * lead came from. Built by the attribution engine at submission time from
 * the raw UTM / referrer / landing-page payload the embed script captures.
 */
export interface AttributionSource {
  /** machine key: "meta_ads" | "google_ads" | "organic" | "direct" | "email" | "referral" | "other" */
  channel: AttributionChannel;
  /** e.g. "Meta Ads", "Google Organic", "Direct" — what we show in the UI */
  label: string;
  /** campaign name if captured (utm_campaign) */
  campaign: string | null;
  /** referring host if no UTM, e.g. "instagram.com" */
  referrerHost: string | null;
  /** plain-English explanation we put in the lead detail drawer */
  explanation: string;
  /** "high" (full UTM trail), "medium" (referrer), "low" (direct/unknown) */
  confidence: AttributionConfidence;
}

export type AttributionChannel =
  | "meta_ads"
  | "google_ads"
  | "google_organic"
  | "organic"
  | "direct"
  | "email"
  | "referral"
  | "other";

export type AttributionConfidence = "high" | "medium" | "low";

/** Raw attribution payload the embed script sends with every submission. */
export interface AttributionPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmId?: string;
  /** Meta / Google click IDs for server-side matching later */
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  /** page the form itself was embedded on */
  pageUrl: string;
  userAgent?: string;
}

export interface Lead {
  id: LeadId;
  workspaceId: WorkspaceId;
  formId: FormId;
  /** Submitted field values, keyed by FieldId. */
  values: Record<string, string | string[]>;
  /** Contact fields promoted to the top level for fast table rendering. */
  email: string | null;
  name: string | null;
  phone: string | null;
  /** Normalized attribution. */
  source: AttributionSource;
  /** Raw payload we store for auditability. */
  attributionRaw: AttributionPayload;
  /** Request metadata. */
  ipHash: string | null;
  country: string | null;
  createdAt: string;
}

export const toLeadId = (s: string): LeadId => s as LeadId;
