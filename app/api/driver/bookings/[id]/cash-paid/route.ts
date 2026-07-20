import { NextResponse } from "next/server"

import { requireDriverSession } from "@/lib/driver-auth"
import { cashToCollect } from "@/lib/driver-cash"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/vehicles"

/**
 * Driver confirms the passenger paid the remaining balance (or full fare) in cash.
 * Allowed once the trip is Arrived or Completed, when cash is still due.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireDriverSession()
  if ("error" in session) return session.error

  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
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

  if (!booking || booking.driverId !== session.driver.id) {
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

  if (
    booking.paymentStatus === "fully_paid" ||
    booking.paymentStatus === "paid" ||
    booking.isBalanceCharged
  ) {
    return NextResponse.json({
      ok: true,
      alreadyRecorded: true,
      referenceCode: booking.referenceCode,
    })
  }

  const amount = cashToCollect({
    totalPrice: Number(booking.totalPrice),
    balanceDue: Number(booking.balanceDue),
    depositPaid: Number(booking.depositPaid),
    paymentStatus: booking.paymentStatus,
  })

  if (amount <= 0) {
    return NextResponse.json(
      { error: "No cash is due on this booking." },
      { status: 409 },
    )
  }

  // Deposit-only (or unpaid): driver collects cash for the remainder / full fare.
  const now = new Date()
  const total = Number(booking.totalPrice)

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        depositPaid: round2(total),
        balanceDue: 0,
        isBalanceCharged: true,
        balanceChargedAt: now,
        balanceChargedBy: session.driver.name,
        paymentStatus: "fully_paid",
      },
    })

    await tx.payment.create({
      data: {
        bookingId: booking.id,
        type: "balance",
        amount,
        currency: booking.currency,
        status: "fully_paid",
        provider: "manual",
        externalId: `cash:${booking.id}:${now.getTime()}`,
        paidAt: now,
      },
    })
  })

  const { notifyAdminsCashPaid } = await import("@/lib/push-notifications")
  notifyAdminsCashPaid({
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    amount,
    currency: booking.currency,
    driverName: session.driver.name,
  })

  return NextResponse.json({
    ok: true,
    alreadyRecorded: false,
    referenceCode: booking.referenceCode,
    amount,
  })
}
