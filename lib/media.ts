import { access, mkdir, readdir, stat, unlink } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"

import { prisma } from "@/lib/db"
import {
  MEDIA_URL_PREFIX,
  isLocalMediaUrl,
  slugifyFilenameBase,
  titleFromFilename,
} from "@/lib/media-shared"

export {
  MEDIA_URL_PREFIX,
  type MediaAssetDto,
  type MediaMeta,
  serializeMediaAsset,
  isUploadHashLabel,
  titleFromFilename,
  originalFilenameForDisplay,
  slugifyFilenameBase,
  isLocalMediaUrl,
  resolveMediaAlt,
} from "@/lib/media-shared"

export const MEDIA_UPLOAD_DIR =
  process.env.UPLOAD_DIR?.trim() ||
  path.join(process.cwd(), "public", "uploads", "pages")

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
}

export function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? ""
}

export function absolutePathFromMediaUrl(url: string): string | null {
  if (!isLocalMediaUrl(url)) return null
  const filename = path.basename(url)
  if (!filename || filename.includes("..")) return null
  return path.join(MEDIA_UPLOAD_DIR, filename)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Build a readable on-disk / public filename from the original upload name.
 * Example: "Traveler App.webp" → traveler-app.webp
 * On conflict: traveler-app-a1b2c3.webp
 */
export async function allocateStoredFilename(
  clientName: string,
  ext: string,
): Promise<string> {
  await mkdir(MEDIA_UPLOAD_DIR, { recursive: true })
  const slug = slugifyFilenameBase(clientName)
  const preferred = `${slug}.${ext}`
  if (!(await fileExists(path.join(MEDIA_UPLOAD_DIR, preferred)))) {
    return preferred
  }
  for (let i = 0; i < 8; i++) {
    const suffix = randomBytes(3).toString("hex")
    const candidate = `${slug}-${suffix}.${ext}`
    if (!(await fileExists(path.join(MEDIA_UPLOAD_DIR, candidate)))) {
      return candidate
    }
  }
  return `${slug}-${Date.now().toString(36)}.${ext}`
}

/** Ensure every file under public/uploads/pages has a MediaAsset row. */
export async function syncMediaAssetsFromDisk(): Promise<void> {
  await mkdir(MEDIA_UPLOAD_DIR, { recursive: true })
  const entries = await readdir(MEDIA_UPLOAD_DIR).catch(() => [] as string[])
  const files = entries.filter((name) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? ""
    return Boolean(MIME_BY_EXT[ext])
  })
  if (files.length === 0) return

  const existing = await prisma.mediaAsset.findMany({
    where: { url: { in: files.map((f) => `${MEDIA_URL_PREFIX}/${f}`) } },
    select: { url: true },
  })
  const known = new Set(existing.map((row) => row.url))

  for (const filename of files) {
    const url = `${MEDIA_URL_PREFIX}/${filename}`
    if (known.has(url)) continue
    const filePath = path.join(MEDIA_UPLOAD_DIR, filename)
    const info = await stat(filePath).catch(() => null)
    if (!info?.isFile()) continue
    await prisma.mediaAsset.create({
      data: {
        url,
        filename,
        mimeType: mimeFromFilename(filename),
        sizeBytes: info.size,
        title: titleFromFilename(filename),
        description: "",
        alt: "",
      },
    })
  }
}

export async function deleteMediaFile(url: string): Promise<void> {
  const filePath = absolutePathFromMediaUrl(url)
  if (!filePath) return
  await unlink(filePath).catch(() => undefined)
}

/** Look up library metadata for local upload URLs. */
export async function mediaMetaByUrls(
  urls: string[],
): Promise<Map<string, import("@/lib/media-shared").MediaMeta>> {
  const local = [
    ...new Set(
      urls.filter(
        (url) => typeof url === "string" && url.startsWith(MEDIA_URL_PREFIX),
      ),
    ),
  ]
  if (local.length === 0) return new Map()

  const rows = await prisma.mediaAsset.findMany({
    where: { url: { in: local } },
    select: { url: true, title: true, description: true, alt: true },
  })

  return new Map(
    rows.map((row) => [
      row.url,
      {
        title: row.title,
        description: row.description,
        alt: row.alt,
      },
    ]),
  )
}
