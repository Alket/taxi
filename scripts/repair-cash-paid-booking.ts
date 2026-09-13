/**
 * One-off repair: mark a completed cash-on-arrival booking as fully paid
 * when the driver already tapped Cash Collected but paymentStatus stuck on unpaid.
 *
 * Usage (live / prod shell with DATABASE_URL set):
 *
 *   # Dry-run (default) — prints what would change
 *   npx tsx scripts/repair-cash-paid-booking.ts TRF-9F0D7E
 *
 *   # Apply
 *   npx tsx scripts/repair-cash-paid-booking.ts TRF-9F0D7E --apply
 *
 * Docker example:
 *   docker compose exec -T app npx tsx scripts/repair-cash-paid-booking.ts TRF-9F0D7E --apply
 */
import { existsSync } from "fs"
import { resolve } from "path"

import { PrismaClient } from "@prisma/client"

// Optional: host/dev may use .env. Prod Docker already injects DATABASE_URL.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config: loadEnv } = require("dotenv") as typeof import("dotenv")
  loadEnv({ path: resolve(process.cwd(), ".env") })
} catch {
  /* dotenv not installed in slim prod image — fine when env is set */
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

import { round2 } from "../lib/vehicles"

const prisma = new PrismaClient()

async function main() {
  const referenceCode = (process.argv[2] || "").trim().toUpperCase()
  const apply = process.argv.includes("--apply")

  if (!referenceCode) {
    console.error(
      "Usage: npx tsx scripts/repair-cash-paid-booking.ts TRF-XXXXXX [--apply]",
    )
    process.exit(1)
  }

  const booking = await prisma.booking.findUnique({
    where: { referenceCode },
    include: {
      customer: { select: { name: true, email: true } },
      driver: { select: { name: true } },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          provider: true,
          externalId: true,
          type: true,
        },
      },
    },
  })

  if (!booking) {
    console.error(`Booking ${referenceCode} not found.`)
    process.exit(1)
  }

  const total = Number(booking.totalPrice)
  const depositPaid = Number(booking.depositPaid)
  const balanceDue = Number(booking.balanceDue)
  const cashPayments = booking.payments.filter((p) =>
    (p.externalId || "").startsWith(`cash:${booking.id}`),
  )

  console.log("\nCurrent booking")
  console.log({
    referenceCode: booking.referenceCode,
    customer: booking.customer.name,
    email: booking.customer.email,
    driver: booking.driver?.name ?? null,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalPrice: total,
    depositPaid,
    balanceDue,
    isBalanceCharged: booking.isBalanceCharged,
    cashPaymentRows: cashPayments.length,
  })

  if (booking.paymentStatus === "fully_paid" || booking.paymentStatus === "paid") {
    console.log("\nAlready paid — nothing to repair.")
    return
  }

  if (booking.status !== "completed" && booking.status !== "arrived") {
    console.error(
      `\nRefusing: status is "${booking.status}". Only arrived/completed cash repairs are supported.`,
    )
    process.exit(1)
  }

  const settleAmount =
    balanceDue > 0 ? balanceDue : Math.max(0, total - depositPaid) || total

  const patch = {
    depositPaid: round2(total),
    balanceDue: 0,
    isBalanceCharged: true,
    balanceChargedAt: booking.balanceChargedAt ?? new Date(),
    balanceChargedBy:
      booking.balanceChargedBy ?? booking.driver?.name ?? "repair-script",
    paymentStatus: "fully_paid" as const,
  }

  console.log("\nProposed repair")
  console.log(patch)
  console.log({
    createCashPayment:
      cashPayments.length === 0
        ? {
            type: "balance",
            amount: round2(settleAmount),
            currency: booking.currency,
            status: "fully_paid",
            provider: "manual",
            externalId: `cash:${booking.id}:repair`,
          }
        : "(already has cash: payment — skip create)",
  })

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.")
    return
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        ...patch,
        balanceChargedAt: patch.balanceChargedAt ?? now,
      },
    })

    if (cashPayments.length === 0 && settleAmount > 0) {
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          type: "balance",
          amount: round2(settleAmount),
          currency: booking.currency,
          status: "fully_paid",
          provider: "manual",
          externalId: `cash:${booking.id}:repair`,
          paidAt: now,
        },
      })
    }
  })

  const after = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: {
      paymentStatus: true,
      depositPaid: true,
      balanceDue: true,
      isBalanceCharged: true,
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
