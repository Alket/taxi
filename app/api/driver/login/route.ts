import { NextResponse } from "next/server"

import { clientIpFromRequest } from "@/lib/client-ip"
import {
  createDriverSession,
  findDriverForLoginPhone,
  normalizePhone,
  verifyDriverPin,
} from "@/lib/driver-auth"
import { driverLoginSchema } from "@/lib/driver-login-schema"
import { prisma } from "@/lib/db"
import { serializeDriver } from "@/lib/drivers"
import { takeRateLimit } from "@/lib/rate-limit"

const INVALID = "Invalid phone or PIN."

/** Caps PIN spray from one client (4-digit PIN space is small). */
const LOGIN_IP_LIMIT = 20
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000
/** Caps attempts against a single driver phone. */
const LOGIN_PHONE_LIMIT = 8
const LOGIN_PHONE_WINDOW_MS = 15 * 60 * 1000

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: `Too many login attempts. Try again in ${retryAfterSec}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  )
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request)
  const ipLimited = takeRateLimit(
    `driver-login-ip:${ip}`,
    LOGIN_IP_LIMIT,
    LOGIN_IP_WINDOW_MS,
  )
  if (!ipLimited.ok) return tooMany(ipLimited.retryAfterSec)

  const body = await request.json().catch(() => null)
  const parsed = driverLoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID }, { status: 400 })
  }

  const phoneNorm = normalizePhone(parsed.data.phone)
  if (!phoneNorm) {
    return NextResponse.json({ error: INVALID }, { status: 400 })
  }

  const phoneLimited = takeRateLimit(
    `driver-login-phone:${phoneNorm}`,
    LOGIN_PHONE_LIMIT,
    LOGIN_PHONE_WINDOW_MS,
  )
  if (!phoneLimited.ok) return tooMany(phoneLimited.retryAfterSec)

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
