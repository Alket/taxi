import { NextResponse } from "next/server"
import { z } from "zod"

import { hashDriverPin } from "@/lib/driver-auth"
import {
  DRIVER_BUSY_STATUSES,
  pickupMinuteRange,
} from "@/lib/driver-availability"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DRIVER_PUBLIC_SELECT, serializeDriver } from "@/lib/drivers"

const createDriverSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(50),
  whatsappNumber: z.string().trim().max(50).optional().or(z.literal("")),
  vehicleMake: z.string().trim().max(100).optional().or(z.literal("")),
  vehicleModel: z.string().trim().max(100).optional().or(z.literal("")),
  plateNumber: z.string().trim().min(1).max(50),
  languages: z.array(z.string().trim().min(1).max(50)).default([]),
  pin: z.string().trim().min(4).max(12).optional().or(z.literal("")),
})

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("active") === "true"
  const forBookingId = searchParams.get("forBookingId")
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = Math.min(
    100,
    parsePositiveInt(searchParams.get("pageSize"), 50),
  )

  const where = activeOnly ? { active: true } : undefined

  const [total, drivers, booking] = await Promise.all([
    prisma.driver.count({ where }),
    prisma.driver.findMany({
      where,
      select: DRIVER_PUBLIC_SELECT,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    forBookingId
      ? prisma.booking.findUnique({
          where: { id: forBookingId },
          select: { id: true, pickupDateTime: true },
        })
      : Promise.resolve(null),
  ])

  let busyByDriver = new Map<
    string,
    { referenceCode: string; pickupDateTime: Date }
  >()

  if (booking) {
    const { start, end } = pickupMinuteRange(booking.pickupDateTime)
    const conflicts = await prisma.booking.findMany({
      where: {
        id: { not: booking.id },
        driverId: { in: drivers.map((d) => d.id) },
        status: { in: DRIVER_BUSY_STATUSES },
        pickupDateTime: { gte: start, lt: end },
      },
      select: {
        driverId: true,
        referenceCode: true,
        pickupDateTime: true,
      },
    })
    busyByDriver = new Map(
      conflicts
        .filter((c) => c.driverId)
        .map((c) => [
          c.driverId!,
          {
            referenceCode: c.referenceCode,
            pickupDateTime: c.pickupDateTime,
          },
        ]),
    )
  }

  return NextResponse.json({
    drivers: drivers.map((driver) => {
      const conflict = busyByDriver.get(driver.id)
      return {
        ...serializeDriver(driver),
        busy: Boolean(conflict),
        conflictReference: conflict?.referenceCode ?? null,
      }
    }),
    total,
    page,
    pageSize,
  })
}

export async function POST(request: Request) {
  const denied = await requireAdmin(
    "Your account cannot add drivers. Ask an admin.",
  )
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = createDriverSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid driver payload." },
      { status: 400 },
    )
  }

  const data = parsed.data
  const pinHash =
    data.pin && data.pin.length >= 4 ? await hashDriverPin(data.pin) : null

  try {
    const driver = await prisma.driver.create({
      data: {
        name: data.name,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber || data.phone,
        vehicleMake: data.vehicleMake || "",
        vehicleModel: data.vehicleModel || "",
        plateNumber: data.plateNumber,
        vehicleType: "sedan",
        languages: data.languages,
        vetted: false,
        active: true,
        avgRating: 0,
        pinHash,
      },
      select: DRIVER_PUBLIC_SELECT,
    })

    return NextResponse.json(
      { driver: serializeDriver(driver) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: "Could not create driver. Plate number may already be in use." },
      { status: 409 },
    )
  }
}
