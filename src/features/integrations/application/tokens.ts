import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Token encryption utility. OAuth access + refresh tokens must never
 * land on disk in plaintext — the 0004_integrations.sql migration
 * declares `access_token_encrypted bytea` + `refresh_token_encrypted
 * bytea` with that in mind.
 *
 * Algorithm: AES-256-GCM.
 *   - Key derived from `OAUTH_TOKEN_ENCRYPTION_KEY` via scrypt with
 *     a fixed salt (the salt isn't a secret; the pepper is the env var).
 *   - Each encryption gets a fresh 12-byte IV.
 *   - Output layout: iv (12) || authTag (16) || ciphertext.
 *
 * The whole blob is base64-encoded when stored as text to keep the
 * Supabase TypeScript client happy (bytea is typed as `string`).
 */

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = Buffer.from("formtrack-token-salt-v1");

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY is missing or too short (need at least 16 chars).",
    );
  }
  cachedKey = scryptSync(secret, SALT, KEY_LEN);
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(blob: string): string {
  const key = getKey();
  const raw = Buffer.from(blob, "base64");
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("decryptToken: ciphertext too short");
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── OAuth state token (CSRF protection) ─────────────────
// Signed with the same key — used so the callback route can confirm
// the state it receives was one we emitted.
import { createHmac, timingSafeEqual } from "node:crypto";

export function signOAuthState(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getKey())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export interface OAuthStatePayload {
  readonly w: string; // workspace id
  readonly u: string; // user id
  readonly p: string; // provider
  readonly n: string; // nonce
}

export function verifyOAuthState(token: string): OAuthStatePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getKey())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.w !== "string" ||
      typeof parsed.u !== "string" ||
      typeof parsed.p !== "string" ||
      typeof parsed.n !== "string"
    ) {
      return null;
    }
    return { w: parsed.w, u: parsed.u, p: parsed.p, n: parsed.n };
  } catch {
    return null;
  }
}
