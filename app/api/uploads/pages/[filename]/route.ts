import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

import { MEDIA_UPLOAD_DIR, mimeFromFilename } from "@/lib/media"

type RouteContext = {
  params: Promise<{ filename: string }>
}

/**
 * Serves CMS / media uploads from disk.
 * Reached via next.config beforeFiles rewrite `/uploads/pages/:filename`
 * so Docker volume uploads work in standalone (build-time public manifest
 * does not include runtime files; afterFiles rewrites never ran for them).
 */
const NOT_FOUND_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function GET(_request: Request, context: RouteContext) {
  const { filename: raw } = await context.params
  const filename = path.basename(raw || "")
  if (!filename || filename !== raw || filename.includes("..")) {
    return new NextResponse("Not found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    })
  }

  try {
    const filePath = path.join(MEDIA_UPLOAD_DIR, filename)
    // Ensure resolved path stays inside the upload dir.
    if (!filePath.startsWith(MEDIA_UPLOAD_DIR)) {
      return new NextResponse("Not found", {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      })
    }
    const buffer = await readFile(filePath)
    const contentType = mimeFromFilename(filename) || "application/octet-stream"
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    }
    // SVGs can execute script if opened as a document — lock that down while
    // still allowing <img src> / CSS use (scripts already blocked in <img>).
    if (contentType === "image/svg+xml") {
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    }
    return new NextResponse(buffer, {
      status: 200,
      headers,
    })
  } catch {
    return new NextResponse("Not found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    })
  }
}
