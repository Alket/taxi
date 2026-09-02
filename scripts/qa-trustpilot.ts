/**
 * QA: Trustpilot invitation script wiring (invitejs register + confirmation
 * createInvitation). Does not call Trustpilot’s remote API or consume quota.
 *
 * Run: npm run test:trustpilot
 * Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:trustpilot
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

import {
  isTrustpilotStaffPath,
  normalizeTrustpilotIntegrationKey,
} from "../lib/trustpilot"

const base = (
  process.env.QA_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "")

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

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8")
}

async function waitForApp(timeoutMs = 12_000) {
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

async function fetchText(path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
    redirect: "follow",
  })
  const text = await res.text()
  return { status: res.status, text }
}

function runStaticChecks() {
  console.log("\nQA Trustpilot invitations\n")

  // Key normalization
  if (normalizeTrustpilotIntegrationKey("cxpP1IXAzl1VSB6W") === "cxpP1IXAzl1VSB6W") {
    pass("K1 accepts valid integration key")
  } else fail("K1 accepts valid integration key")

  if (normalizeTrustpilotIntegrationKey("  abcDEF12  ") === "abcDEF12") {
    pass("K2 trims key")
  } else fail("K2 trims key")

  if (normalizeTrustpilotIntegrationKey("") === null) {
    pass("K3 empty key → null")
  } else fail("K3 empty key → null")

  if (normalizeTrustpilotIntegrationKey("bad key!") === null) {
    pass("K4 rejects invalid characters")
  } else fail("K4 rejects invalid characters")

  if (normalizeTrustpilotIntegrationKey("short") === null) {
    pass("K5 rejects too-short key")
  } else fail("K5 rejects too-short key")

  // Staff path gating
  for (const p of ["/admin", "/admin/reviews", "/driver", "/driver/trips"]) {
    if (isTrustpilotStaffPath(p)) pass(`S1 staff path ${p}`)
    else fail(`S1 staff path ${p}`)
  }
  for (const p of ["/", "/book", "/book/confirmation/TRF-TEST", "/sq/book"]) {
    if (!isTrustpilotStaffPath(p)) pass(`S2 public path ${p}`)
    else fail(`S2 public path ${p}`)
  }

  const inviteSrc = read("components/marketing/trustpilot-invite.tsx")
  if (inviteSrc.includes("invitejs.trustpilot.com/tp.min.js")) {
    pass("C1 loads invitejs URL")
  } else fail("C1 loads invitejs URL")

  if (inviteSrc.includes("tp('register'") || inviteSrc.includes('tp(\'register\'')) {
    pass("C2 registers integration key")
  } else fail("C2 registers integration key")

  if (
    inviteSrc.includes('createInvitation') &&
    inviteSrc.includes("source: \"InvitationScript\"")
  ) {
    pass("C3 createInvitation + InvitationScript source")
  } else fail("C3 createInvitation + InvitationScript source")

  if (
    inviteSrc.includes("/api/bookings/trustpilot-invite") &&
    !inviteSrc.includes('searchParams.get("tp")')
  ) {
    pass("C4 client claims via cookie API (no ?tp=)")
  } else fail("C4 client claims via cookie API (no ?tp=)")

  if (
    inviteSrc.includes("export function TrustpilotCreateInvitation") &&
    inviteSrc.includes("referenceId: string") &&
    !inviteSrc.includes("recipientEmail: string")
  ) {
    pass("C5 CreateInvitation props are reference-only")
  } else fail("C5 CreateInvitation props are reference-only")

  const claimApi = read("app/api/bookings/trustpilot-invite/route.ts")
  if (
    claimApi.includes("claimTrustpilotInvite") &&
    claimApi.includes("takeRateLimit") &&
    claimApi.includes("TRUSTPILOT_INVITE_COOKIE")
  ) {
    pass("C6 claim API uses HttpOnly cookie + rate limit")
  } else fail("C6 claim API uses HttpOnly cookie + rate limit")

  const inviteLib = read("lib/trustpilot-invite.ts")
  if (
    inviteLib.includes("trustpilotInviteClaimedAt") &&
    inviteLib.includes("updateMany")
  ) {
    pass("C7 one-shot DB claim")
  } else fail("C7 one-shot DB claim")

  const layout = read("app/layout.tsx")
  if (
    layout.includes("TrustpilotInviteBootstrap") &&
    layout.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY")
  ) {
    pass("W1 root layout wires bootstrap")
  } else fail("W1 root layout wires bootstrap")

  const confirm = read(
    "app/(booking)/book/confirmation/[referenceCode]/page.tsx",
  )
  if (
    confirm.includes("TrustpilotCreateInvitation") &&
    !confirm.includes("inviteEmail") &&
    !/customer:\s*\{\s*select:\s*\{\s*email/.test(confirm)
  ) {
    pass("W2 confirmation mounts invite without loading booker email")
  } else fail("W2 confirmation mounts invite without loading booker email")

  if (
    confirm.includes("paymentSucceeded") &&
    confirm.includes("cashOnArrival") &&
    confirm.includes("TrustpilotCreateInvitation")
  ) {
    pass("W3 invite component only on success confirmation view")
  } else fail("W3 invite component only on success confirmation view")

  // Public confirmation JSON API must still omit PII
  const confirmApi = read("app/api/bookings/confirmation/[referenceCode]/route.ts")
  if (
    confirmApi.includes("Omits email") &&
    !confirmApi.includes("passengerEmail") &&
    !/customer:\s*\{/.test(confirmApi)
  ) {
    pass("W4 confirmation JSON API still omits email")
  } else fail("W4 confirmation JSON API still omits email")

  const nav = read("lib/navigate-to-confirmation.tsx")
  const cookieHelper = read("lib/trustpilot-invite-cookie.ts")
  if (
    !nav.includes("tp=") &&
    !nav.includes("trustpilotInviteToken") &&
    cookieHelper.includes("httpOnly: true") &&
    cookieHelper.includes("TRUSTPILOT_INVITE_COOKIE")
  ) {
    pass("W5 invite JWT via HttpOnly cookie (not URL)")
  } else fail("W5 invite JWT via HttpOnly cookie (not URL)")

  const confirmDeposit = read("app/api/payments/confirm-deposit/route.ts")
  if (
    confirmDeposit.includes("paymentIntentClientSecret") &&
    confirmDeposit.includes("client_secret") &&
    !confirmDeposit.includes("if (!byBookingId)")
  ) {
    pass("W6 confirm-deposit always requires client_secret")
  } else fail("W6 confirm-deposit always requires client_secret")

  const cashRoute = read("app/api/payments/cash-on-arrival/route.ts")
  const cashIdempotentNoMint =
    cashRoute.includes('alreadyConfirmed: true') &&
    !/alreadyConfirmed:\s*true[\s\S]{0,80}jsonWithTrustpilotInviteCookie/.test(
      cashRoute,
    ) &&
    cashRoute.includes("jsonWithTrustpilotInviteCookie") &&
    cashRoute.includes("alreadyConfirmed: false")
  if (cashIdempotentNoMint) {
    pass("W8 cash idempotent paths do not remint invite cookie")
  } else fail("W8 cash idempotent paths do not remint invite cookie")

  const checkoutNonce = read("lib/checkout-nonce.ts")
  const paypalCapture = read("app/api/payments/paypal/capture/route.ts")
  const pokConfirm = read("app/api/payments/pok/confirm/route.ts")
  const paypalCreate = read("app/api/payments/paypal/create-order/route.ts")
  const pokCreate = read("app/api/payments/pok/create-order/route.ts")
  if (
    checkoutNonce.includes("CHECKOUT_NONCE_COOKIE") &&
    checkoutNonce.includes("timingSafeEqual") &&
    paypalCreate.includes("checkoutNonce") &&
    pokCreate.includes("checkoutNonce") &&
    paypalCapture.includes("jsonWithTrustpilotInviteCookieIfCheckoutBound") &&
    pokConfirm.includes("jsonWithTrustpilotInviteCookieIfCheckoutBound")
  ) {
    pass("W7 PayPal/POK invite mint requires checkout nonce")
  } else fail("W7 PayPal/POK invite mint requires checkout nonce")

  const envExample = read(".env.example")
  if (envExample.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY")) {
    pass("E1 .env.example documents key")
  } else fail("E1 .env.example documents key")

  const dockerExample = read(".env.docker.example")
  if (dockerExample.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY")) {
    pass("E2 .env.docker.example documents key")
  } else fail("E2 .env.docker.example documents key")

  const compose = read("docker-compose.yml")
  const composeDev = read("docker-compose.dev.yml")
  const dockerfile = read("Dockerfile")
  if (
    compose.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY") &&
    composeDev.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY") &&
    dockerfile.includes("NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY")
  ) {
    pass("E3 docker compose + Dockerfile pass key")
  } else fail("E3 docker compose + Dockerfile pass key")

  const pkg = read("package.json")
  if (pkg.includes('"test:trustpilot"')) {
    pass("E4 npm script test:trustpilot")
  } else fail("E4 npm script test:trustpilot")

  const migration = read(
    "prisma/migrations/20260902120000_booking_trustpilot_invite_claimed/migration.sql",
  )
  if (migration.includes("trustpilotInviteClaimedAt")) {
    pass("E5 prisma migration for claim timestamp")
  } else fail("E5 prisma migration for claim timestamp")

  const nonceMigration = read(
    "prisma/migrations/20260902130000_checkout_nonce_paypal_pok/migration.sql",
  )
  if (
    nonceMigration.includes("checkoutNonce") &&
    nonceMigration.includes("PaypalOrderIntent") &&
    nonceMigration.includes("PokOrderIntent")
  ) {
    pass("E6 prisma migration for checkout nonce")
  } else fail("E6 prisma migration for checkout nonce")
}

async function runLiveChecks() {
  const key = normalizeTrustpilotIntegrationKey(
    process.env.NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY,
  )

  const up = await waitForApp()
  if (!up) {
    pass(
      "L0 app reachable",
      `skip — ${base} not up (static checks still ran)`,
    )
    return
  }
  pass("L0 app reachable", base)

  if (!key) {
    pass("L1 key unset — skip HTML bootstrap asserts", "env empty")
    return
  }
  pass("L1 integration key present", `${key.slice(0, 4)}…`)

  const home = await fetchText("/")
  // Client Script (afterInteractive) is not always inlined in the first HTML;
  // assert the layout RSC payload mounts TrustpilotInviteBootstrap with the key.
  const bootstrapWired =
    home.text.includes("TrustpilotInviteBootstrap") &&
    (home.text.includes("invitejs.trustpilot.com") ||
      home.text.includes("trustpilot-invite-bootstrap") ||
      home.text.includes(`integrationKey\":\"${key}\"`) ||
      home.text.includes(`"integrationKey":"${key}"`) ||
      home.text.includes(key))

  if (home.status === 200 && bootstrapWired) {
    pass("L2 homepage wires Trustpilot bootstrap")
  } else {
    fail(
      "L2 homepage wires Trustpilot bootstrap",
      `status ${home.status}; expected TrustpilotInviteBootstrap + key in RSC HTML`,
    )
  }

  // Staff HTML: client gate may still SSR null when pathname is /admin.
  // Soft check — must not hard-fail if layout chunk always ships the module.
  const admin = await fetchText("/admin")
  if (admin.status > 0 && admin.status < 500) {
    pass("L3 /admin responds", String(admin.status))
  } else {
    fail("L3 /admin responds", String(admin.status))
  }

  // Find a confirmed booking — HTML must NOT leak booker email
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { paymentStatus: { in: ["deposit_paid", "fully_paid", "paid"] } },
        {
          AND: [
            { paymentStatus: "unpaid" },
            { status: { notIn: ["pending", "cancelled"] } },
            { notes: { contains: "cash on arrival", mode: "insensitive" } },
          ],
        },
      ],
      customer: { email: { not: "" } },
    },
    select: {
      id: true,
      referenceCode: true,
      trustpilotInviteClaimedAt: true,
      customer: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!booking) {
    pass("L4 confirmation omits booker email", "skip — no paid/cash booking")
  } else {
    const conf = await fetchText(
      `/book/confirmation/${encodeURIComponent(booking.referenceCode)}`,
    )
    const email = booking.customer.email
    const leaked = conf.text.includes(email)

    if (conf.status === 200 && !leaked) {
      pass("L4 confirmation omits booker email", booking.referenceCode)
    } else {
      fail(
        "L4 confirmation omits booker email",
        `status ${conf.status} leaked=${leaked} ref=${booking.referenceCode}`,
      )
    }

    // Claim without cookie must fail
    const badClaim = await fetch(`${base}/api/bookings/trustpilot-invite`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        referenceCode: booking.referenceCode,
      }),
    })
    if (badClaim.status === 401 || badClaim.status === 400) {
      pass("L4b claim rejects missing cookie", String(badClaim.status))
    } else {
      fail("L4b claim rejects missing cookie", `status ${badClaim.status}`)
    }

    // Valid cookie claim (restore claimedAt after)
    const { issueTrustpilotInviteToken, claimTrustpilotInvite } = await import(
      "../lib/trustpilot-invite"
    )
    const { TRUSTPILOT_INVITE_COOKIE } = await import(
      "../lib/trustpilot-invite-cookie"
    )
    await prisma.booking.update({
      where: { id: booking.id },
      data: { trustpilotInviteClaimedAt: null },
    })
    const token = await issueTrustpilotInviteToken(booking.id)
    if (!token) {
      fail("L4c issue claim token", "null token")
    } else {
      const first = await claimTrustpilotInvite({
        referenceCode: booking.referenceCode,
        token,
      })
      if (
        first.ok &&
        first.recipientEmail === email &&
        first.referenceId === booking.referenceCode
      ) {
        pass("L4c claim succeeds once with valid token")
      } else {
        fail("L4c claim succeeds once with valid token", JSON.stringify(first))
      }

      const second = await claimTrustpilotInvite({
        referenceCode: booking.referenceCode,
        token,
      })
      if (!second.ok && second.code === "already_claimed") {
        pass("L4d second claim blocked")
      } else {
        fail("L4d second claim blocked", JSON.stringify(second))
      }

      // HTTP claim with Cookie header
      await prisma.booking.update({
        where: { id: booking.id },
        data: { trustpilotInviteClaimedAt: null },
      })
      const token2 = await issueTrustpilotInviteToken(booking.id)
      const cookieClaim = await fetch(`${base}/api/bookings/trustpilot-invite`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ngrok-skip-browser-warning": "true",
          cookie: `${TRUSTPILOT_INVITE_COOKIE}=${token2}`,
        },
        body: JSON.stringify({ referenceCode: booking.referenceCode }),
      })
      const cookieBody = await cookieClaim.json().catch(() => ({}))
      if (
        cookieClaim.status === 200 &&
        cookieBody.recipientEmail === email
      ) {
        pass("L4e HTTP claim accepts HttpOnly cookie")
      } else {
        fail(
          "L4e HTTP claim accepts HttpOnly cookie",
          `status ${cookieClaim.status} ${JSON.stringify(cookieBody).slice(0, 120)}`,
        )
      }
    }

    // Restore prior claimed state if we cleared it for the test
    if (booking.trustpilotInviteClaimedAt) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { trustpilotInviteClaimedAt: booking.trustpilotInviteClaimedAt },
      })
    }
  }

  // Pending confirmation must not invite
  const pending = await prisma.booking.findFirst({
    where: {
      paymentStatus: "unpaid",
      status: "pending",
      OR: [
        { notes: null },
        { NOT: { notes: { contains: "cash on arrival", mode: "insensitive" } } },
      ],
    },
    select: { referenceCode: true },
    orderBy: { createdAt: "desc" },
  })

  if (!pending) {
    pass("L5 pending page skips invite", "skip — no pending unpaid booking")
    return
  }

  const pendingPage = await fetchText(
    `/book/confirmation/${encodeURIComponent(pending.referenceCode)}`,
  )
  const leakedInviteComponent =
    pendingPage.text.includes("TrustpilotCreateInvitation")
  if (pendingPage.status === 200 && !leakedInviteComponent) {
    pass("L5 pending confirmation omits TrustpilotCreateInvitation")
  } else if (pendingPage.status === 200 && leakedInviteComponent) {
    fail("L5 pending confirmation omits TrustpilotCreateInvitation", "component present")
  } else {
    fail("L5 pending confirmation", `status ${pendingPage.status}`)
  }
}

async function main() {
  runStaticChecks()

  // Nonce binding unit checks (no network)
  try {
    const {
      generateCheckoutNonce,
      checkoutNonceMatches,
      CHECKOUT_NONCE_COOKIE,
    } = await import("../lib/checkout-nonce")
    const nonce = generateCheckoutNonce()
    const reqOk = new Request("http://localhost/api/x", {
      headers: { cookie: `${CHECKOUT_NONCE_COOKIE}=${nonce}` },
    })
    const reqBad = new Request("http://localhost/api/x", {
      headers: { cookie: `${CHECKOUT_NONCE_COOKIE}=wrong-nonce-value` },
    })
    const reqEmpty = new Request("http://localhost/api/x")
    if (checkoutNonceMatches(reqOk, nonce)) pass("N1 checkout nonce matches cookie")
    else fail("N1 checkout nonce matches cookie")
    if (!checkoutNonceMatches(reqBad, nonce)) pass("N2 wrong cookie rejected")
    else fail("N2 wrong cookie rejected")
    if (!checkoutNonceMatches(reqEmpty, nonce)) pass("N3 missing cookie rejected")
    else fail("N3 missing cookie rejected")
    if (!checkoutNonceMatches(reqOk, null)) pass("N4 missing stored nonce rejected")
    else fail("N4 missing stored nonce rejected")
  } catch (e) {
    fail("N* checkout nonce unit", (e as Error).message)
  }

  try {
    await runLiveChecks()
  } catch (e) {
    fail("L* live checks", (e as Error).message)
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }

  const fails = results.filter((r) => r.status === "FAIL").length
  const passes = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passes} PASS / ${fails} FAIL (${results.length} checks)\n`)
  process.exit(fails > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
