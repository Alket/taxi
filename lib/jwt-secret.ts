/**
 * Shared JWT secret loading for admin + driver session tokens.
 * Fails closed on missing, short, or known-insecure placeholder values.
 */

const MIN_JWT_SECRET_LENGTH = 32

/** Exact matches (case-insensitive) that must never be used in any environment. */
const FORBIDDEN_JWT_SECRETS = new Set([
  "change-me-to-a-long-random-string",
  "secret",
  "changeme",
  "change-me",
  "password",
  "jwt_secret",
  "jwt-secret",
  "build-time-placeholder",
  "placeholder",
  "your-secret-here",
  "dev",
  "test",
  "development",
])

export function assertJwtSecret(secret: string | undefined | null): string {
  const value = secret?.trim() ?? ""
  if (!value) {
    throw new Error("JWT_SECRET is not set")
  }
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
    )
  }
  if (FORBIDDEN_JWT_SECRETS.has(value.toLowerCase())) {
    throw new Error(
      "JWT_SECRET matches a known insecure default/placeholder — set a unique random secret",
    )
  }
  return value
}

export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(assertJwtSecret(process.env.JWT_SECRET))
}
