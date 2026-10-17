import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Authenticated encryption for cookie values, built on node:crypto
 * (AES-256-GCM): no dependency to vet, and a tampered, truncated or expired
 * value is rejected before anything is parsed. Cookies are only ever handled
 * by Node route handlers, so Web Crypto's portability is not needed.
 *
 * Wire format: `v1.` + base64url(iv | ciphertext | tag).
 * - The key is derived (HKDF-SHA256) per purpose, so a value sealed for one
 *   cookie cannot be opened as another.
 * - The purpose is also bound as additional authenticated data.
 * - The expiry lives inside the encrypted payload, so a client cannot extend it
 *   by editing the cookie's Max-Age.
 */

const PREFIX = "v1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Sealed values here are a token or a short state; anything bigger is junk. */
const MAX_SEALED_LENGTH = 2048;

function keyFor(secret: string, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      "howcommitted:seal:v1",
      `purpose:${purpose}`,
      32,
    ),
  );
}

type Envelope = { exp: number; data: unknown };

/** Encrypts `data` (JSON-serializable) so it is valid for `ttlSeconds`. */
export function seal(
  purpose: string,
  data: unknown,
  secret: string,
  ttlSeconds: number,
  now: Date,
): string {
  const envelope: Envelope = {
    exp: Math.floor(now.getTime() / 1000) + ttlSeconds,
    data,
  };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret, purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(envelope), "utf8"),
    cipher.final(),
  ]);
  const sealed = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
  return `${PREFIX}${sealed.toString("base64url")}`;
}

/** The sealed data, or null when it is malformed, tampered with, from another purpose or expired. */
export function open(
  purpose: string,
  value: string | undefined,
  secret: string,
  now: Date,
): unknown {
  if (!value || value.length > MAX_SEALED_LENGTH || !value.startsWith(PREFIX)) {
    return null;
  }
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(secret, purpose),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
    const envelope = JSON.parse(plain) as Partial<Envelope>;
    if (
      typeof envelope.exp !== "number" ||
      envelope.exp <= Math.floor(now.getTime() / 1000)
    ) {
      return null;
    }
    return envelope.data ?? null;
  } catch {
    return null;
  }
}
