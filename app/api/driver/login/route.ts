import { NextResponse } from "next/server"

import {
  createDriverSession,
  findDriverForLoginPhone,
  normalizePhone,
  verifyDriverPin,
} from "@/lib/driver-auth"
import { driverLoginSchema } from "@/lib/driver-login-schema"
import { prisma } from "@/lib/db"
import { serializeDriver } from "@/lib/drivers"

const INVALID = "Invalid phone or PIN."

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = driverLoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID }, { status: 400 })
  }

  const phoneNorm = normalizePhone(parsed.data.phone)
  if (!phoneNorm) {
    return NextResponse.json({ error: INVALID }, { status: 400 })
  }

  const drivers = await prisma.driver.findMany({
    where: { active: true, pinHash: { not: null } },
    select: {
      id: true,
      name: true,
      phone: true,
      whatsappNumber: true,
      vehicleMake: true,
      vehicleModel: true,
      plateNumber: true,
      languages: true,
      vetted: true,
      active: true,
      avgRating: true,
      pinHash: true,
    },
  })

  const driver = findDriverForLoginPhone(drivers, parsed.data.phone)

  if (!driver?.pinHash) {
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  if (!(await verifyDriverPin(parsed.data.pin, driver.pinHash))) {
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  await createDriverSession(driver.id)

  return NextResponse.json({
    success: true,
    driver: serializeDriver(driver),
  })
}
