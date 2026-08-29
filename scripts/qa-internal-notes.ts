/**
 * QA: staff-only booking internal notes — static leak checks + live API roles.
 *
 * Run on host:  npm run test:internal-notes
 * Run in Docker: docker compose -f docker-compose.dev.yml exec -T app npm run test:internal-notes
 *
 * Live checks mint JWT cookies against the DB (admin + temporary operator).
 * Loads `.env` for JWT_SECRET; defaults DATABASE_URL to the compose-published
 * Postgres port when unset (host runs do not inherit the container env).
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

import { config as loadEnv } from "dotenv"
import { hash } from "bcryptjs"
import { PrismaClient } from "@prisma/client"

loadEnv({ path: resolve(process.cwd(), ".env") })

const runningInDocker = existsSync("/.dockerenv")

if (!process.env.DATABASE_URL) {
  // Host default: compose publishes Postgres on localhost:5432
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/taxi?schema=public"
} else if (!runningInDocker && /@db(?=:\d+)/.test(process.env.DATABASE_URL)) {
  // Container hostname only resolves inside compose — rewrite for host runs.
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /@db(?=:\d+)/,
    "@127.0.0.1",
  )
}

import { SESSION_COOKIE, signSessionToken } from "../lib/session"

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

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8")
}

async function waitForApp(timeoutMs = 180_000) {
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
  console.log(`\nQA internal notes @ ${base}\n`)

  // ---------------------------------------------------------------------------
  // A — Files / schema / wiring
  // ---------------------------------------------------------------------------
  const required = [
    "prisma/migrations/20260829190000_booking_internal_notes/migration.sql",
    "app/api/admin/bookings/[id]/internal-notes/route.ts",
    "components/bookings/booking-detail.tsx",
  ]
  let filesOk = true
  for (const file of required) {
    if (!existsSync(resolve(file))) {
      filesOk = false
      fail("A1 files", `missing ${file}`)
      break
    }
  }
  if (filesOk) pass("A1 internal-notes files present")

  const schema = read("prisma/schema.prisma")
  if (
    schema.includes("internalNotes") &&
    schema.includes("model BookingInternalNoteEvent") &&
    schema.includes("internalNotesUpdatedById")
  ) {
    pass("A2 Prisma internalNotes + audit model")
  } else {
    fail("A2 Prisma", "internalNotes / audit fields missing")
  }

  const serializer = read("lib/bookings.ts")
  if (
    serializer.includes("internalNotes: booking.internalNotes") &&
    serializer.includes("internalNoteHistory") &&
    serializer.includes("internalNotesUpdatedBy")
  ) {
    pass("A3 detail serializer includes notes + audit/history")
  } else {
    fail("A3 admin serializer", "audit/history not serialized on detail")
  }

  const listFn = serializer.slice(
    serializer.indexOf("export function serializeBookingListItem"),
    serializer.indexOf("export function serializeBookingDetail"),
  )
  if (listFn && !listFn.includes("internalNotes")) {
    pass("A3b list serializer omits internalNotes")
  } else {
    fail("A3b list serializer", "internalNotes should not be on list")
  }

  const ui = read("components/bookings/booking-detail.tsx")
  if (
    ui.includes("InternalNotesSection") &&
    ui.includes("/internal-notes") &&
    ui.includes("Only admins can delete this note") &&
    ui.includes("History") &&
    ui.includes("Last edited")
  ) {
    pass("A4 BookingDetail UI + history + last edited")
  } else {
    fail("A4 BookingDetail UI", "missing section / history / last edited")
  }

  const route = read("app/api/admin/bookings/[id]/route.ts")
  if (!route.includes("internalNotes")) {
    pass("A5 general booking PATCH does not accept internalNotes")
  } else {
    fail("A5 booking PATCH", "should not handle internalNotes")
  }

  if (
    existsSync(resolve("lib/internal-notes.ts")) &&
    read("lib/internal-notes.ts").includes("applyInternalNotesChange")
  ) {
    pass("A6 applyInternalNotesChange helper")
  } else {
    fail("A6 helper", "lib/internal-notes.ts missing")
  }

  // ---------------------------------------------------------------------------
  // B — Leak surfaces must never mention internalNotes
  // ---------------------------------------------------------------------------
  const leakFiles = [
    "lib/managed-booking.ts",
    "app/api/bookings/confirmation/[referenceCode]/route.ts",
    "app/(booking)/book/confirmation/[referenceCode]/page.tsx",
    "app/api/driver/bookings/route.ts",
    "lib/emails/booking-events.ts",
    "lib/create-booking.ts",
  ]
  let leaks = 0
  for (const file of leakFiles) {
    if (read(file).includes("internalNotes")) {
      leaks++
      fail("B1 leak", file)
    }
  }
  if (leaks === 0) pass("B1 client/driver/email surfaces omit internalNotes")

  // ---------------------------------------------------------------------------
  // C — Live app + API role checks
  // ---------------------------------------------------------------------------
  const up = await waitForApp()
  if (!up) {
    fail("C0 app up", `no response from ${base}`)
  } else {
    pass("C0 app responding")
  }

  const booking = await prisma.booking.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, referenceCode: true, internalNotes: true },
  })
  if (!booking) {
    fail("C1 booking fixture", "no bookings in DB — seed or create one")
  } else {
    pass("C1 booking fixture", booking.referenceCode)
  }

  const admin = await prisma.adminUser.findFirst({
    where: { role: "admin", suspended: false },
    orderBy: { createdAt: "asc" },
  })
  if (!admin) fail("C2 admin user", "no admin in DB")
  else pass("C2 admin user", admin.email)

  const qaOperatorEmail = "qa-internal-notes-operator@transfers.local"
  let operator = await prisma.adminUser.findUnique({
    where: { email: qaOperatorEmail },
  })
  if (!operator) {
    operator = await prisma.adminUser.create({
      data: {
        name: "QA Operator",
        email: qaOperatorEmail,
        passwordHash: await hash("qa-operator-temp", 10),
        role: "operator",
        suspended: false,
        requiresPasswordReset: false,
      },
    })
  } else if (operator.role !== "operator" || operator.suspended) {
    operator = await prisma.adminUser.update({
      where: { id: operator.id },
      data: {
        role: "operator",
        suspended: false,
        requiresPasswordReset: false,
      },
    })
  }
  pass("C3 operator fixture", operator.email)

  if (!up || !booking || !admin) {
    printSummary()
    process.exit(1)
  }

  const adminToken = await signSessionToken(admin.id)
  const operatorToken = await signSessionToken(operator.id)
  const noteMarker = `QA internal note ${Date.now()}`
  const previousNotes = booking.internalNotes

  // Start from an empty note so the first write is classified as "created".
  await prisma.bookingInternalNoteEvent.deleteMany({
    where: { bookingId: booking.id },
  })
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      internalNotes: null,
      internalNotesUpdatedAt: null,
      internalNotesUpdatedById: null,
    },
  })

  try {
    const unauth = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "PATCH",
        body: JSON.stringify({ internalNotes: "should fail" }),
      },
    )
    if (unauth.status === 401) pass("C4 unauthenticated PATCH → 401")
    else fail("C4 unauthenticated PATCH", `status ${unauth.status}`)

    const opAdd = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "PATCH",
        token: operatorToken,
        body: JSON.stringify({ internalNotes: noteMarker }),
      },
    )
    if (
      opAdd.status === 200 &&
      opAdd.body?.booking?.internalNotes === noteMarker
    ) {
      pass("C5 operator can add/edit internal note")
    } else {
      fail(
        "C5 operator add",
        `status ${opAdd.status} body=${JSON.stringify(opAdd.body).slice(0, 200)}`,
      )
    }

    const createdEvent = opAdd.body?.booking?.internalNoteHistory?.[0]
    if (
      createdEvent?.action === "created" &&
      createdEvent?.nextText === noteMarker &&
      createdEvent?.actorName &&
      opAdd.body?.booking?.internalNotesUpdatedBy?.id === operator.id
    ) {
      pass("C5b create writes history + updatedBy")
    } else {
      fail("C5b create audit", JSON.stringify(createdEvent ?? {}).slice(0, 200))
    }

    const opClear = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "PATCH",
        token: operatorToken,
        body: JSON.stringify({ internalNotes: "" }),
      },
    )
    if (opClear.status === 403) pass("C6 operator clear via PATCH → 403")
    else fail("C6 operator clear PATCH", `status ${opClear.status}`)

    const opDelete = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "DELETE",
        token: operatorToken,
      },
    )
    if (opDelete.status === 403) pass("C7 operator DELETE → 403")
    else fail("C7 operator DELETE", `status ${opDelete.status}`)

    const stillThere = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { internalNotes: true },
    })
    if (stillThere?.internalNotes === noteMarker) {
      pass("C8 note retained after operator delete attempts")
    } else {
      fail("C8 note retained", `got ${stillThere?.internalNotes}`)
    }

    const adminGet = await api(`/api/admin/bookings/${booking.id}`, {
      token: adminToken,
    })
    if (adminGet.body?.booking?.internalNotes === noteMarker) {
      pass("C9 admin GET returns internalNotes")
    } else {
      fail(
        "C9 admin GET",
        `status ${adminGet.status} notes=${adminGet.body?.booking?.internalNotes}`,
      )
    }

    const adminEdit = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "PATCH",
        token: adminToken,
        body: JSON.stringify({ internalNotes: `${noteMarker} edited` }),
      },
    )
    if (
      adminEdit.status === 200 &&
      adminEdit.body?.booking?.internalNotes === `${noteMarker} edited`
    ) {
      pass("C10 admin can edit internal note")
    } else {
      fail("C10 admin edit", `status ${adminEdit.status}`)
    }

    const updatedEvent = adminEdit.body?.booking?.internalNoteHistory?.[0]
    if (
      updatedEvent?.action === "updated" &&
      updatedEvent?.previousText === noteMarker &&
      updatedEvent?.nextText === `${noteMarker} edited` &&
      adminEdit.body?.booking?.internalNotesUpdatedBy?.id === admin.id
    ) {
      pass("C10b update writes history with previous/next")
    } else {
      fail(
        "C10b update audit",
        JSON.stringify(updatedEvent ?? {}).slice(0, 200),
      )
    }

    const adminDelete = await api(
      `/api/admin/bookings/${booking.id}/internal-notes`,
      {
        method: "DELETE",
        token: adminToken,
      },
    )
    if (
      adminDelete.status === 200 &&
      (adminDelete.body?.booking?.internalNotes ?? null) === null
    ) {
      pass("C11 admin DELETE clears note")
    } else {
      fail("C11 admin DELETE", `status ${adminDelete.status}`)
    }

    const deletedEvent = adminDelete.body?.booking?.internalNoteHistory?.[0]
    if (
      deletedEvent?.action === "deleted" &&
      deletedEvent?.previousText === `${noteMarker} edited` &&
      (deletedEvent?.nextText ?? null) === null
    ) {
      pass("C11b delete writes history with previous text")
    } else {
      fail(
        "C11b delete audit",
        JSON.stringify(deletedEvent ?? {}).slice(0, 200),
      )
    }

    const list = await api("/api/admin/bookings?pageSize=5", {
      token: adminToken,
    })
    const listText = JSON.stringify(list.body ?? {})
    if (
      list.status === 200 &&
      !listText.includes("internalNotes") &&
      !listText.includes("internalNoteHistory")
    ) {
      pass("C11c list API omits internalNotes / history")
    } else {
      fail("C11c list leak", `status ${list.status}`)
    }

    // Public confirmation / managed lookup must not expose the field even if set
    await prisma.booking.update({
      where: { id: booking.id },
      data: { internalNotes: "SECRET_SHOULD_NOT_LEAK" },
    })
    const full = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { referenceCode: true, pickupPin: true },
    })
    if (full) {
      const conf = await api(
        `/api/bookings/confirmation/${encodeURIComponent(full.referenceCode)}`,
      )
      const confText = JSON.stringify(conf.body ?? {})
      if (
        conf.status === 200 &&
        !confText.includes("internalNotes") &&
        !confText.includes("SECRET_SHOULD_NOT_LEAK")
      ) {
        pass("C12 confirmation API does not leak internalNotes")
      } else {
        fail(
          "C12 confirmation leak",
          `status ${conf.status} leaked=${confText.includes("SECRET_SHOULD_NOT_LEAK")}`,
        )
      }

      const lookup = await api("/api/bookings/lookup", {
        method: "POST",
        body: JSON.stringify({
          referenceCode: full.referenceCode,
          pickupPin: full.pickupPin,
        }),
      })
      const lookupText = JSON.stringify(lookup.body ?? {})
      if (
        !lookupText.includes("internalNotes") &&
        !lookupText.includes("SECRET_SHOULD_NOT_LEAK")
      ) {
        pass("C13 lookup API does not leak internalNotes")
      } else {
        fail("C13 lookup leak", `status ${lookup.status}`)
      }
    }
  } finally {
    await prisma.bookingInternalNoteEvent
      .deleteMany({
        where: {
          bookingId: booking.id,
          OR: [
            { nextText: { contains: "QA internal note" } },
            { previousText: { contains: "QA internal note" } },
          ],
        },
      })
      .catch(() => {})
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        internalNotes: previousNotes,
        internalNotesUpdatedAt: null,
        internalNotesUpdatedById: null,
      },
    })
    await prisma.adminUser.delete({ where: { id: operator.id } }).catch(() => {
      // keep fixture if delete blocked
    })
  }

  printSummary()
  const failed = results.filter((r) => r.status === "FAIL").length
  process.exit(failed > 0 ? 1 : 0)
}

function printSummary() {
  const failed = results.filter((r) => r.status === "FAIL").length
  const passed = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passed} PASS, ${failed} FAIL\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
