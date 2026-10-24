import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticated encryption (AES-256-GCM) for cookie payloads. The browser only
 * ever sees opaque ciphertext; tampering or a wrong key makes `unseal` return null.
 * Format: base64url(version(1) | iv(12) | tag(16) | ciphertext)
 */

const VERSION = 1;

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`qgf:${purpose}:`).update(secret).digest();
}

export function seal(payload: unknown, secret: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function unseal<T>(token: string | undefined | null, secret: string, purpose: string): T | null {
  if (!token || token.length > 8192) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 1 + 12 + 16 + 1 || raw[0] !== VERSION) return null;
    const iv = raw.subarray(1, 13);
    const tag = raw.subarray(13, 29);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(raw.subarray(29)), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
