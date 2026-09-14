/**
 * QA: Trustpilot testimonials + review visibility toggles.
 *
 * Run: npm run test:trustpilot-testimonials
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:trustpilot-testimonials
 */
import { existsSync, readFileSync } from "fs"
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

import { SESSION_COOKIE, signSessionToken } from "../lib/session"
import { SETTINGS_ID } from "../lib/settings"

const base = (process.env.QA_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
)
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
}
function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}

async function waitForApp(timeoutMs = 90_000) {
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
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function api(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const { token, ...rest } = init
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`

  const res = await fetch(`${base}${path}`, { ...rest, headers })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 240) }
  }
  return { status: res.status, body }
}

async function main() {
  console.log(`\nQA Trustpilot testimonials @ ${base}\n`)

  const schema = read("prisma/schema.prisma")
  if (
    schema.includes("model TrustpilotTestimonial") &&
    schema.includes("customerReviewsVisibleOnSite") &&
    schema.includes("trustpilotTestimonialsVisibleOnSite")
  ) {
    pass("S1 schema model + settings fields")
  } else fail("S1 schema")

  if (existsSync(resolve("prisma/migrations/20260914180000_trustpilot_testimonials/migration.sql"))) {
    pass("S2 migration present")
  } else fail("S2 migration")

  const adminUi = read("components/admin/reviews-view.tsx")
  if (
    adminUi.includes("CustomerReviewsVisibilityCard") &&
    adminUi.includes("TrustpilotTestimonialsAdmin")
  ) {
    pass("S3 admin reviews wiring")
  } else fail("S3 admin reviews wiring")

  const home = read("components/marketing/home-landing.tsx")
  if (
    home.includes("showCustomerReviews") &&
    home.includes("showTrustpilotTestimonials") &&
    home.includes("TestimonialsSection")
  ) {
    pass("S4 home landing gates")
  } else fail("S4 home landing")

  const dest = read("app/(booking)/destinations/[slug]/page.tsx")
  const testimonials = read("components/marketing/testimonials-section.tsx")
  if (
    dest.includes("showCustomerReviews") &&
    dest.includes("showTrustpilotTestimonials") &&
    testimonials.includes("TrustpilotTestimonialsContent") &&
    testimonials.includes("Traveller stories")
  ) {
    pass("S5 destination + shared Traveller stories section")
  } else fail("S5 destination page")

  if (!(await waitForApp())) {
    fail("app reachable", base)
    printSummary()
    process.exit(1)
  }
  pass("app reachable", base)

  let createdId: string | null = null
  let displayBefore: Record<string, unknown> | null = null

  try {
    const admin = await prisma.adminUser.findFirst({
      where: { role: "admin", suspended: false },
    })
    if (!admin) {
      fail("admin fixture", "none")
      printSummary()
      process.exit(1)
    }
    if (admin.requiresPasswordReset) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { requiresPasswordReset: false },
      })
    }
    const token = await signSessionToken(admin.id)
    pass("admin fixture", admin.email)

    const unauth = await api("/api/admin/trustpilot-testimonials")
    if (unauth.status === 401 || unauth.status === 403) {
      pass("A0 admin list auth-gated", String(unauth.status))
    } else fail("A0 admin list auth", String(unauth.status))

    const before = await api("/api/admin/review-site-display", { token })
    if (before.status === 200 && before.body?.display) {
      displayBefore = before.body.display
      pass("A1 load display settings")
    } else {
      fail("A1 load display", String(before.status))
      printSummary()
      process.exit(1)
    }

    const create = await api("/api/admin/trustpilot-testimonials", {
      method: "POST",
      token,
      body: JSON.stringify({
        authorName: "QA Trustpilot",
        rating: 5,
        body: "Excellent airport transfer — QA only.",
        reviewedAt: "2026-09-01",
        published: true,
        sortOrder: 0,
      }),
    })
    createdId = create.body?.testimonial?.id ?? null
    if (create.status === 201 && createdId) {
      pass("A2 create testimonial", createdId)
    } else {
      fail(
        "A2 create",
        `${create.status} ${JSON.stringify(create.body).slice(0, 180)}`,
      )
    }

    const draft = await api("/api/admin/trustpilot-testimonials", {
      method: "POST",
      token,
      body: JSON.stringify({
        authorName: "QA Draft",
        rating: 4,
        body: "Should not appear when unpublished.",
        published: false,
      }),
    })
    const draftId = draft.body?.testimonial?.id as string | undefined

    await api("/api/admin/review-site-display", {
      method: "PATCH",
      token,
      body: JSON.stringify({
        trustpilotTestimonialsVisibleOnSite: true,
        trustpilotDisplayScore: 4.4,
        trustpilotDisplayCount: 5,
      }),
    })

    const pub = await api("/api/trustpilot-testimonials/public")
    if (
      pub.status === 200 &&
      pub.body?.visible === true &&
      Number(pub.body?.summary?.score) === 4.4 &&
      Number(pub.body?.summary?.count) === 5 &&
      Array.isArray(pub.body?.testimonials) &&
      pub.body.testimonials.some((t: any) => t.id === createdId) &&
      !pub.body.testimonials.some((t: any) => t.id === draftId)
    ) {
      pass("A3 public shows published only + manual summary")
    } else {
      fail(
        "A3 public payload",
        `${pub.status} ${JSON.stringify(pub.body).slice(0, 220)}`,
      )
    }

    await api("/api/admin/review-site-display", {
      method: "PATCH",
      token,
      body: JSON.stringify({ trustpilotTestimonialsVisibleOnSite: false }),
    })
    const hidden = await api("/api/trustpilot-testimonials/public")
    if (
      hidden.status === 200 &&
      hidden.body?.visible === false &&
      (hidden.body?.testimonials?.length ?? 0) === 0
    ) {
      pass("A4 public empty when Trustpilot carousel hidden")
    } else {
      fail("A4 hidden", JSON.stringify(hidden.body).slice(0, 160))
    }

    await api("/api/admin/review-site-display", {
      method: "PATCH",
      token,
      body: JSON.stringify({ customerReviewsVisibleOnSite: false }),
    })
    const flags = await api("/api/reviews/site-display")
    if (
      flags.status === 200 &&
      flags.body?.customerReviewsVisibleOnSite === false &&
      flags.body?.trustpilotTestimonialsVisibleOnSite === false
    ) {
      pass("A5 site-display flags")
    } else {
      fail("A5 site-display", JSON.stringify(flags.body).slice(0, 160))
    }

    if (draftId) {
      await prisma.trustpilotTestimonial.delete({ where: { id: draftId } }).catch(() => {})
    }
  } finally {
    if (createdId) {
      await prisma.trustpilotTestimonial
        .delete({ where: { id: createdId } })
        .catch(() => {})
    }
    if (displayBefore) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: {
          customerReviewsVisibleOnSite: Boolean(
            displayBefore.customerReviewsVisibleOnSite,
          ),
          trustpilotTestimonialsVisibleOnSite: Boolean(
            displayBefore.trustpilotTestimonialsVisibleOnSite,
          ),
          trustpilotDisplayScore: Number(displayBefore.trustpilotDisplayScore) || 0,
          trustpilotDisplayCount: Number(displayBefore.trustpilotDisplayCount) || 0,
          trustpilotProfileUrl:
            String(displayBefore.trustpilotProfileUrl || "") ||
            "https://www.trustpilot.com/review/landedalbania.com",
        },
      })
    }
    await prisma.$disconnect()
  }

  printSummary()
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
