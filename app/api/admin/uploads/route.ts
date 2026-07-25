import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"

const MAX_BYTES = 5 * 1024 * 1024
const MAX_SVG_BYTES = 512 * 1024
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

  const buffer = Buffer.from(await file.arrayBuffer())
  if (ext === "svg") {
    const text = buffer.toString("utf8").trim().toLowerCase()
    if (!text.includes("<svg") || text.includes("<script")) {
      return NextResponse.json(
        { error: "Invalid or unsafe SVG file." },
        { status: 400 },
      )
    }
  }

  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads", "pages")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), buffer)

  const url = `/uploads/pages/${filename}`
  return NextResponse.json({ url })
}
