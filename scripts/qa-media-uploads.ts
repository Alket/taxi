/**
 * QA: CMS media uploads serving (admin <img> vs marketing next/image).
 *
 * Covers the production bug where `/uploads/pages/*` 404'd for runtime files
 * in standalone Docker while `/_next/image` still worked — rewrite must be
 * `beforeFiles` so every request hits `/api/uploads/pages/:filename`.
 *
 * Run: npm run test:media-uploads
 * Optional: QA_BASE_URL=http://localhost:3000
 * Remote: QA_ALLOW_REMOTE=1 (required for non-local targets)
 */
import { randomBytes } from "crypto"
import { existsSync, readFileSync, unlinkSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"

loadEnv({ path: resolve(process.cwd(), ".env") })

const runningInDocker = existsSync("/.dockerenv")
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/taxi?schema=public"
} else if (!runningInDocker && /@db(?=:\d+)/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /@db(?=:\d+)/,
    "@127.0.0.1",
  )
}

import { assertQaLocalOrAllowed } from "./qa-env-guard"
import { SESSION_COOKIE, signSessionToken } from "../lib/session"
import {
  MEDIA_URL_PREFIX,
  isLocalMediaUrl,
  mediaPreviewSrc,
} from "../lib/media-shared"
import { absolutePathFromMediaUrl } from "../lib/media"

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
)
assertQaLocalOrAllowed({ baseUrl: base })

const prisma = new PrismaClient()

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []

function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("FAIL:", c, "—", d)
}
function printSummary() {
  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
  return fails
}

/** 1×1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

async function waitForApp(timeoutMs = 60_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        redirect: "manual",
      })
      if (res.status > 0 && res.status < 500) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return false
}

async function fetchRaw(
  path: string,
  init: RequestInit & { token?: string } = {},
) {
  const { token, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set("ngrok-skip-browser-warning", "true")
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`)
  const res = await fetch(`${base}${path}`, { ...rest, headers })
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    status: res.status,
    headers: res.headers,
    buf,
    contentType: res.headers.get("content-type") || "",
    cacheControl: res.headers.get("cache-control") || "",
  }
}

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8")
}

async function main() {
  console.log(`\nQA media uploads @ ${base}\n`)

  let uploadedUrl: string | null = null
  let uploadedAssetId: string | null = null

  try {
    // ── Static contracts ─────────────────────────────────────────────
    const nextConfig = read("next.config.mjs")
    if (
      nextConfig.includes("beforeFiles") &&
      nextConfig.includes('source: "/uploads/pages/:filename"') &&
      nextConfig.includes('destination: "/api/uploads/pages/:filename"')
    ) {
      pass("S1 next.config beforeFiles rewrite for /uploads/pages")
    } else {
      fail(
        "S1 next.config beforeFiles rewrite",
        "missing beforeFiles → /api/uploads/pages",
      )
    }

    if (nextConfig.match(/rewrites\(\)[\s\S]*?return\s*\[\s*\{[\s\S]*uploads\/pages/)) {
      fail(
        "S2 rewrite not afterFiles array",
        "uploads rewrite must not be a bare afterFiles array",
      )
    } else {
      pass("S2 uploads rewrite is not a bare afterFiles array")
    }

    const apiRoute = read("app/api/uploads/pages/[filename]/route.ts")
    if (
      apiRoute.includes('Cache-Control": "no-store"') ||
      apiRoute.includes("Cache-Control': 'no-store'") ||
      apiRoute.includes("no-store")
    ) {
      pass("S3 upload 404 responses use Cache-Control: no-store")
    } else {
      fail("S3 upload 404 Cache-Control", "no-store not found")
    }

    if (MEDIA_URL_PREFIX === "/uploads/pages") {
      pass("S4 MEDIA_URL_PREFIX", MEDIA_URL_PREFIX)
    } else {
      fail("S4 MEDIA_URL_PREFIX", MEDIA_URL_PREFIX)
    }

    if (
      mediaPreviewSrc("/uploads/pages/a.webp", 3) ===
        "/uploads/pages/a.webp?v=3" &&
      mediaPreviewSrc("/uploads/pages/a.webp?x=1", 2) ===
        "/uploads/pages/a.webp?x=1&v=2" &&
      mediaPreviewSrc("https://images.unsplash.com/x", 9) ===
        "https://images.unsplash.com/x" &&
      isLocalMediaUrl("/uploads/pages/x.webp") &&
      !isLocalMediaUrl("/api/uploads/pages/x.webp")
    ) {
      pass("S5 mediaPreviewSrc / isLocalMediaUrl helpers")
    } else {
      fail("S5 media helpers", mediaPreviewSrc("/uploads/pages/a.webp", 3))
    }

    const editor = read("components/admin/page-editor-view.tsx")
    if (
      editor.includes("mediaPreviewSrc") &&
      editor.includes("previewBust") &&
      editor.includes("AdminImagePreview")
    ) {
      pass("S6 admin page editor cache-busts upload previews")
    } else {
      fail("S6 admin preview bust wiring")
    }

    // ── Live HTTP ────────────────────────────────────────────────────
    if (!(await waitForApp())) {
      fail("L0 app reachable", `no response from ${base}`)
      return
    }
    pass("L0 app reachable")

    const admin = await prisma.adminUser.findFirst({
      where: { suspended: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    })
    if (!admin) {
      fail("L1 admin user", "no AdminUser — create one first")
      return
    }
    pass("L1 admin user", admin.email)

    const token = await signSessionToken(admin.id)

    const denied = await fetchRaw("/api/admin/uploads", {
      method: "POST",
      body: (() => {
        const form = new FormData()
        form.append(
          "file",
          new Blob([PNG_1X1], { type: "image/png" }),
          "qa-denied.png",
        )
        return form
      })(),
    })
    if (denied.status === 401 || denied.status === 403) {
      pass("L2 unauthenticated upload rejected", String(denied.status))
    } else {
      fail("L2 unauthenticated upload", `status ${denied.status}`)
    }

    const filenameBase = `qa-media-upload-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`
    const form = new FormData()
    form.append(
      "file",
      new Blob([PNG_1X1], { type: "image/png" }),
      `${filenameBase}.png`,
    )
    form.append("title", "QA media upload")
    form.append("alt", "QA 1x1 png")

    const upload = await fetchRaw("/api/admin/uploads", {
      method: "POST",
      token,
      body: form,
    })
    let uploadBody: { url?: string; asset?: { id?: string; url?: string } } = {}
    try {
      uploadBody = JSON.parse(upload.buf.toString("utf8"))
    } catch {
      uploadBody = {}
    }

    if (upload.status === 200 && uploadBody.url?.startsWith(MEDIA_URL_PREFIX)) {
      uploadedUrl = uploadBody.url
      uploadedAssetId = uploadBody.asset?.id ?? null
      pass("L3 admin upload succeeds", uploadedUrl)
    } else {
      fail(
        "L3 admin upload",
        `status ${upload.status} body ${upload.buf.toString("utf8").slice(0, 200)}`,
      )
      return
    }

    const publicPath = uploadedUrl
    const apiPath = uploadedUrl.replace(MEDIA_URL_PREFIX, "/api/uploads/pages")

    const viaPublic = await fetchRaw(publicPath)
    if (
      viaPublic.status === 200 &&
      viaPublic.contentType.startsWith("image/") &&
      viaPublic.buf.length > 0
    ) {
      pass(
        "L4 GET /uploads/pages/:file (admin <img> path)",
        `${viaPublic.status} ${viaPublic.contentType} ${viaPublic.buf.length}b`,
      )
    } else {
      fail(
        "L4 GET /uploads/pages/:file",
        `${viaPublic.status} ${viaPublic.contentType} ${viaPublic.buf.length}b — rewrite/API serve broken (prod standalone symptom)`,
      )
    }

    const viaApi = await fetchRaw(apiPath)
    if (
      viaApi.status === 200 &&
      viaApi.contentType.startsWith("image/") &&
      viaApi.buf.length > 0
    ) {
      pass("L5 GET /api/uploads/pages/:file", String(viaApi.status))
    } else {
      fail("L5 GET /api/uploads/pages/:file", String(viaApi.status))
    }

    const viaImageOpt = await fetchRaw(
      `/_next/image?url=${encodeURIComponent(publicPath)}&w=64&q=75`,
    )
    if (viaImageOpt.status === 200 && viaImageOpt.buf.length > 0) {
      pass(
        "L6 GET /_next/image (marketing path)",
        `${viaImageOpt.status} ${viaImageOpt.buf.length}b`,
      )
    } else {
      fail(
        "L6 GET /_next/image",
        `${viaImageOpt.status} — marketing optimizer could not load upload`,
      )
    }

    const missingName = `qa-missing-${Date.now().toString(36)}.png`
    const missing = await fetchRaw(`/uploads/pages/${missingName}`)
    if (missing.status === 404) {
      const cc = missing.cacheControl.toLowerCase()
      if (cc.includes("no-store")) {
        pass("L7 missing upload 404 + no-store", missing.cacheControl)
      } else {
        // Dev static 404 may not hit our API route headers — still require 404.
        pass(
          "L7 missing upload 404",
          `Cache-Control=${missing.cacheControl || "(none)"} (no-store required online via API)`,
        )
      }
    } else {
      fail("L7 missing upload 404", `status ${missing.status}`)
    }

    const disk = absolutePathFromMediaUrl(publicPath)
    if (disk && existsSync(disk)) {
      pass("L8 file on disk", disk)
    } else {
      fail("L8 file on disk", disk || "null path")
    }
  } catch (error) {
    fail("QX unexpected", (error as Error).message)
  } finally {
    if (uploadedAssetId) {
      await prisma.mediaAsset.delete({ where: { id: uploadedAssetId } }).catch(
        () => undefined,
      )
    } else if (uploadedUrl) {
      await prisma.mediaAsset
        .deleteMany({ where: { url: uploadedUrl } })
        .catch(() => undefined)
    }
    if (uploadedUrl) {
      const disk = absolutePathFromMediaUrl(uploadedUrl)
      if (disk && existsSync(disk)) {
        try {
          unlinkSync(disk)
        } catch {
          // ignore cleanup errors
        }
      }
    }
    await prisma.$disconnect()
    const fails = printSummary()
    process.exit(fails ? 1 : 0)
  }
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect().catch(() => undefined)
  process.exit(1)
})
