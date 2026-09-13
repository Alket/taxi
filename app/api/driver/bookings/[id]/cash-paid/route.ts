import { NextResponse } from "next/server"

import { requireDriverSession } from "@/lib/driver-auth"
import { cashToCollect } from "@/lib/driver-cash"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

type CashPaidResult = {
  ok: true
  alreadyRecorded: boolean
  repaired: boolean
  referenceCode: string
  amount: number
}

async function settleCashPaid(args: {
  bookingId: string
  driverId: string
  driverName: string
  totalPrice: number
  amount: number
  currency: string
  now: Date
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: args.bookingId, driverId: args.driverId },
      data: {
        depositPaid: round2(args.totalPrice),
        balanceDue: 0,
        isBalanceCharged: true,
        balanceChargedAt: args.now,
        balanceChargedBy: args.driverName,
        paymentStatus: "fully_paid",
      },
    })
    if (updated.count === 0) {
      throw new Error("BOOKING_OWNERSHIP_LOST")
    }

    const existingCash = await tx.payment.findFirst({
      where: {
        bookingId: args.bookingId,
        externalId: { startsWith: `cash:${args.bookingId}` },
      },
      select: { id: true },
    })
    if (!existingCash && args.amount > 0) {
      await tx.payment.create({
        data: {
          bookingId: args.bookingId,
          type: "balance",
          amount: args.amount,
          currency: args.currency,
          status: "fully_paid",
          provider: "manual",
          externalId: `cash:${args.bookingId}:${args.now.getTime()}`,
          paidAt: args.now,
        },
      })
    }
  })
}

/**
 * Driver confirms the passenger paid the remaining balance (or full fare) in cash.
 * Allowed once Arrived or Completed.
 *
 * Also repairs inconsistent rows where isBalanceCharged is true but paymentStatus
 * is still unpaid/deposit_paid — that left admin showing Unpaid after a “successful”
 * Cash Paid tap.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { id } = await params

  const booking = await prisma.booking.findFirst({
    where: { id, driverId: session.driver.id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalPrice: true,
      depositPaid: true,
      balanceDue: true,
      currency: true,
      isBalanceCharged: true,
      referenceCode: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  }

  if (booking.status !== "arrived" && booking.status !== "completed") {
    return NextResponse.json(
      {
        error:
          "Mark Arrived first, then confirm cash after the passenger pays.",
      },
      { status: 409 },
    )
  }

  const total = Number(booking.totalPrice)
  const amountDue = cashToCollect({
    totalPrice: total,
    balanceDue: Number(booking.balanceDue),
    depositPaid: Number(booking.depositPaid),
    paymentStatus: booking.paymentStatus,
  })

  const paymentSettled =
    booking.paymentStatus === "fully_paid" || booking.paymentStatus === "paid"

  if (paymentSettled) {
    const existingCash = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        externalId: { startsWith: `cash:${booking.id}` },
      },
      select: { amount: true },
    })
    const body: CashPaidResult = {
      ok: true,
      alreadyRecorded: true,
      repaired: false,
      referenceCode: booking.referenceCode,
      amount: existingCash ? Number(existingCash.amount) : 0,
    }
    return NextResponse.json(body)
  }

  // Flag said “charged” but Payment badge still unpaid/deposit — repair it.
  const inconsistentCharged =
    booking.isBalanceCharged &&
    (booking.paymentStatus === "unpaid" ||
      booking.paymentStatus === "deposit_paid" ||
      booking.paymentStatus === "failed")

  if (!inconsistentCharged && amountDue <= 0) {
    return NextResponse.json(
      { error: "No cash is due on this booking." },
      { status: 409 },
    )
  }

  const now = new Date()
  const settleAmount =
    amountDue > 0
      ? amountDue
      : round2(
          Math.max(
            0,
            Number(booking.balanceDue) > 0
              ? Number(booking.balanceDue)
              : total - Number(booking.depositPaid),
          ),
        ) || total

  try {
    await settleCashPaid({
      bookingId: booking.id,
      driverId: session.driver.id,
      driverName: session.driver.name,
      totalPrice: total,
      amount: settleAmount,
      currency: booking.currency,
      now,
    })
  } catch (err) {
    if (err instanceof Error && err.message === "BOOKING_OWNERSHIP_LOST") {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    }
    throw err
  }

  if (!inconsistentCharged) {
    const { notifyAdminsCashPaid } = await import("@/lib/push-notifications")
    notifyAdminsCashPaid({
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      amount: settleAmount,
      currency: booking.currency,
      driverName: session.driver.name,
    })
  }

  const body: CashPaidResult = {
    ok: true,
    alreadyRecorded: inconsistentCharged,
    repaired: inconsistentCharged,
    referenceCode: booking.referenceCode,
    amount: settleAmount,
  }
  return NextResponse.json(body)
}
