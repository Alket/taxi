import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

import { assertJwtSecret } from "@/lib/jwt-secret"

const PREFIX = "enc:v1:"

function deriveKey(): Buffer {
  const secret = assertJwtSecret(process.env.JWT_SECRET)
  return Buffer.from(
    hkdfSync("sha256", secret, "taxi-settings", "secret-box-v1", 32),
  )
}

/** AES-256-GCM encrypt. Returns `enc:v1:<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX)
}

/**
 * Decrypt an `enc:v1:…` payload. Legacy plaintext values (no prefix) are
 * returned unchanged so existing rows keep working until re-saved.
 */
export function decryptSecret(stored: string): string {
  const value = stored.trim()
  if (!value) return ""
  if (!isEncryptedSecret(value)) return value

  const payload = value.slice(PREFIX.length)
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret format.")
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(),
    Buffer.from(ivB64, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
