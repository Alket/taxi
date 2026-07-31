import { writeFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  MEDIA_UPLOAD_DIR,
  MEDIA_URL_PREFIX,
  allocateStoredFilename,
  originalFilenameForDisplay,
  serializeMediaAsset,
  titleFromFilename,
} from "@/lib/media"
import { sanitizeSvgMarkup } from "@/lib/sanitize-svg"

const MAX_BYTES = 5 * 1024 * 1024
const MAX_SVG_BYTES = 512 * 1024
const MAX_META_CHARS = 500
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
])

function resolveExt(file: File): string | null {
  const byType = ALLOWED.get(file.type)
  if (byType) return byType
  // Some browsers send empty/octet-stream for SVG
  if (file.name.toLowerCase().endsWith(".svg")) return "svg"
  return null
}

function formString(form: FormData, key: string): string {
  const value = form.get(key)
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_META_CHARS)
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 })
  }

  const ext = resolveExt(file)
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, GIF, or SVG files are allowed." },
      { status: 400 },
    )
  }

  const maxBytes = ext === "svg" ? MAX_SVG_BYTES : MAX_BYTES
  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json(
      {
        error:
          ext === "svg"
            ? "SVG must be between 1 byte and 512 KB."
            : "Image must be between 1 byte and 5 MB.",
      },
      { status: 400 },
    )
  }

  let buffer = Buffer.from(await file.arrayBuffer())
  if (ext === "svg") {
    try {
      const sanitized = sanitizeSvgMarkup(buffer.toString("utf8"))
      buffer = Buffer.from(sanitized, "utf8")
    } catch {
      return NextResponse.json(
        { error: "Invalid or unsafe SVG file." },
        { status: 400 },
      )
    }
  }

  const storedName = await allocateStoredFilename(file.name, ext)
  await writeFile(path.join(MEDIA_UPLOAD_DIR, storedName), buffer)

  const url = `${MEDIA_URL_PREFIX}/${storedName}`
  const displayName = originalFilenameForDisplay(file.name, ext)
  const title =
    formString(form, "title") ||
    titleFromFilename(file.name) ||
    titleFromFilename(displayName) ||
    "Untitled image"
  const description = formString(form, "description")
  const alt = formString(form, "alt")
  const mimeType = file.type || ALLOWED.get(`image/${ext}`) || ""

  const asset = await prisma.mediaAsset.create({
    data: {
      url,
      filename: displayName,
      mimeType:
        mimeType ||
        (ext === "jpg" ? "image/jpeg" : `image/${ext === "svg" ? "svg+xml" : ext}`),
      sizeBytes: buffer.length,
      title,
      description,
      alt,
    },
  })

  return NextResponse.json({
    url: asset.url,
    asset: serializeMediaAsset(asset),
  })
}
