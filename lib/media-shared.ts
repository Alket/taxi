/** Client-safe media helpers (no Node fs / prisma). */

export const MEDIA_URL_PREFIX = "/uploads/pages"

export type MediaAssetDto = {
  id: string
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
  title: string
  description: string
  alt: string
  createdAt: string
  updatedAt: string
}

export type MediaMeta = {
  title: string
  description: string
  alt: string
}

export function serializeMediaAsset(row: {
  id: string
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
  title: string
  description: string
  alt: string
  createdAt: Date
  updatedAt: Date
}): MediaAssetDto {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    title: row.title,
    description: row.description,
    alt: row.alt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** True when a string looks like an upload id (timestamp-hash), not a real title. */
export function isUploadHashLabel(value: string): boolean {
  return /^\d{10,}-[a-f0-9]{6,}$/i.test(value.trim())
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "")
  // Generated uploads are `{timestamp}-{hex}.ext` — don't use that as a title.
  if (isUploadHashLabel(base)) return ""
  return base.replace(/[-_]+/g, " ").trim()
}

/** Safe original client filename for display (not the unique disk name). */
export function originalFilenameForDisplay(
  clientName: string,
  ext: string,
): string {
  const raw = (clientName || "").split(/[/\\]/).pop()?.trim() ?? ""
  const cleaned = raw
    .replace(/[^\w.\- ()[\]]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "")
  if (!cleaned || isUploadHashLabel(cleaned.replace(/\.[^.]+$/, ""))) {
    return `image.${ext}`
  }
  if (/\.[a-z0-9]+$/i.test(cleaned)) return cleaned
  return `${cleaned}.${ext}`
}

/** URL-safe slug from an original filename (no extension). */
export function slugifyFilenameBase(clientName: string): string {
  const raw = (clientName || "").split(/[/\\]/).pop()?.trim() ?? ""
  const base = raw.replace(/\.[^.]+$/, "")
  if (!base || isUploadHashLabel(base)) return "image"
  const slug = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return slug || "image"
}

export function isLocalMediaUrl(url: string): boolean {
  return url.startsWith(`${MEDIA_URL_PREFIX}/`)
}

/** Prefer library alt, then a real title, then a caller fallback. */
export function resolveMediaAlt(
  meta: MediaMeta | undefined,
  fallback = "",
): string {
  const alt = meta?.alt?.trim()
  if (alt && !isUploadHashLabel(alt)) return alt
  const title = meta?.title?.trim()
  if (title && !isUploadHashLabel(title)) return title
  return fallback
}
