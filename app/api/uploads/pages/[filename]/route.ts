import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

import { MEDIA_UPLOAD_DIR, mimeFromFilename } from "@/lib/media"

type RouteContext = {
  params: Promise<{ filename: string }>
}

/**
 * Serves CMS / media uploads from disk.
 * Used via rewrite from /uploads/pages/:filename so Docker volumes work
 * even when Next standalone static serving misses runtime files.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { filename: raw } = await context.params
  const filename = path.basename(raw || "")
  if (!filename || filename !== raw || filename.includes("..")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const filePath = path.join(MEDIA_UPLOAD_DIR, filename)
    // Ensure resolved path stays inside the upload dir.
    if (!filePath.startsWith(MEDIA_UPLOAD_DIR)) {
      return new NextResponse("Not found", { status: 404 })
    }
    const buffer = await readFile(filePath)
    const contentType = mimeFromFilename(filename) || "application/octet-stream"
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
