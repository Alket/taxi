/**
 * One-off repair: set a stuck Pending booking to Confirmed.
 *
 * Use for admin manual bookings created before admin-create started as Confirmed
 * (e.g. TRF-AA79FB — Joanne IRADUKUNDA).
 *
 * Usage (live / prod shell with DATABASE_URL set):
 *
 *   # Dry-run (default)
 *   npx tsx scripts/repair-pending-to-confirmed.ts TRF-AA79FB
 *
 *   # Apply
 *   npx tsx scripts/repair-pending-to-confirmed.ts TRF-AA79FB --apply
 *
 * Docker:
 *   docker compose exec -T app tsx scripts/repair-pending-to-confirmed.ts TRF-AA79FB
 *   docker compose exec -T app tsx scripts/repair-pending-to-confirmed.ts TRF-AA79FB --apply
 *
 * Self-contained (no lib/* imports) so slim prod images without zod still work.
 */
import { existsSync } from "fs"
import { resolve } from "path"

import { PrismaClient } from "@prisma/client"

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config: loadEnv } = require("dotenv") as typeof import("dotenv")
  loadEnv({ path: resolve(process.cwd(), ".env") })
} catch {
  /* dotenv optional in prod image */
}

const runningInDocker = existsSync("/.dockerenv")
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
} else if (!runningInDocker && /@db(?=:\d+)/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /@db(?=:\d+)/,
    "@127.0.0.1",
  )
}

const prisma = new PrismaClient()

async function main() {
  const referenceCode = (process.argv[2] || "").trim().toUpperCase()
  const apply = process.argv.includes("--apply")

  if (!referenceCode) {
    console.error(
      "Usage: npx tsx scripts/repair-pending-to-confirmed.ts TRF-XXXXXX [--apply]",
    )
    process.exit(1)
  }

  const booking = await prisma.booking.findUnique({
    where: { referenceCode },
    include: {
      customer: { select: { name: true, email: true } },
      statusEvents: {
        orderBy: { timestamp: "asc" },
        select: { status: true, timestamp: true },
      },
    },
  })

  if (!booking) {
    console.error(`Booking ${referenceCode} not found.`)
    process.exit(1)
  }

  console.log("\nCurrent booking")
  console.log({
    referenceCode: booking.referenceCode,
    customer: booking.customer.name,
    email: booking.customer.email,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    notes: booking.notes?.slice(0, 160) ?? null,
    statusEvents: booking.statusEvents.map((e) => e.status),
  })

  if (booking.status === "confirmed") {
    console.log("\nAlready confirmed — nothing to repair.")
    return
  }

  if (booking.status !== "pending") {
    console.error(
      `\nRefusing: status is "${booking.status}". Only pending → confirmed is supported.`,
    )
    process.exit(1)
  }

  const now = new Date()
  console.log("\nProposed repair")
  console.log({
    status: "confirmed",
    statusEvent: { status: "confirmed", timestamp: now.toISOString() },
  })

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.")
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "confirmed" },
    })
    await tx.bookingStatusEvent.create({
      data: {
        bookingId: booking.id,
        status: "confirmed",
        timestamp: now,
      },
    })
  })

  const after = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: {
      referenceCode: true,
      status: true,
      paymentStatus: true,
      customer: { select: { name: true } },
    },
  })

  console.log("\nApplied. Now:")
  console.log(after)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
