/**
 * Encryption for third-party credentials (HubSpot tokens) and signed, expiring tokens for OAuth `state`.
 *
 * AES-256-GCM with a random IV per value, stored as `v1:<iv>:<tag>:<ciphertext>` (base64). The key is
 * INTEGRATION_SECRET_KEY: 32 bytes, base64. It is read on every call so a missing or malformed key fails
 * loudly at the point of use and nothing is ever stored in plaintext as a fallback.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

export class SecretBoxError extends Error {}

const ENV_NAME = "INTEGRATION_SECRET_KEY";

function readKey(): Buffer {
  const raw = process.env[ENV_NAME];
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new SecretBoxError(`${ENV_NAME} must be 32 bytes, base64 encoded`);
  return key;
}

export function secretsConfigured(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

export function seal(plain: string): string {
  const key = readKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function open(sealed: string): string {
  const key = readKey();
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new SecretBoxError("unrecognised secret format");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1]!, "base64"));
    decipher.setAuthTag(Buffer.from(parts[2]!, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3]!, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretBoxError("secret could not be decrypted");
  }
}

// ── Signed state (OAuth CSRF protection) ────────────────────────────────────

const b64u = (b: Buffer) => b.toString("base64url");

function stateMac(body: string): Buffer {
  // A separate label keeps the MAC key distinct from the encryption key.
  return createHmac("sha256", createHmac("sha256", readKey()).update("state-v1").digest()).update(body).digest();
}

export function signState(payload: object, ttlMs: number): string {
  const body = b64u(Buffer.from(JSON.stringify({ p: payload, exp: Date.now() + ttlMs, n: randomBytes(9).toString("hex") })));
  return `${body}.${b64u(stateMac(body))}`;
}

export function verifyState<T = Record<string, unknown>>(token: string): T {
  const [body, mac, extra] = (token ?? "").split(".");
  if (!body || !mac || extra !== undefined) throw new SecretBoxError("invalid state");
  const expected = stateMac(body);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new SecretBoxError("invalid state");
  let parsed: { p: T; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new SecretBoxError("invalid state");
  }
  if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) throw new SecretBoxError("state expired");
  return parsed.p;
}
