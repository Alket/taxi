import type { Driver } from "@/lib/types"
import {
  DRIVER_SESSION_COOKIE,
  DRIVER_SESSION_MAX_AGE,
  signDriverSessionToken,
  verifyDriverSessionToken,
} from "@/lib/driver-session"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { hashPassword, verifyPassword } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeDriver } from "@/lib/drivers"

export { DRIVER_SESSION_COOKIE } from "@/lib/driver-session"

export async function hashDriverPin(pin: string): Promise<string> {
  return hashPassword(pin)
}

export async function verifyDriverPin(
  pin: string,
  hash: string,
): Promise<boolean> {
  return verifyPassword(pin, hash)
}

export async function createDriverSession(driverId: string): Promise<void> {
  const token = await signDriverSessionToken(driverId)
  const cookieStore = await cookies()
  cookieStore.set(DRIVER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRIVER_SESSION_MAX_AGE,
  })
}

export async function clearDriverSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(DRIVER_SESSION_COOKIE)
}

export async function getDriverSession(): Promise<Driver | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(DRIVER_SESSION_COOKIE)?.value
  if (!token) return null

  const driverId = await verifyDriverSessionToken(token)
  if (!driverId) return null

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
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

  if (!driver || !driver.active || !driver.pinHash) return null
  return serializeDriver(driver)
}

export async function requireDriverSession(): Promise<
  { driver: Driver } | { error: NextResponse }
> {
  const driver = await getDriverSession()
  if (!driver) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { driver }
}

/** Normalize phone for loose matching (digits only; leading + ignored). */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\D/g, "")
}

/**
 * Pick the best driver for a login phone.
 * Prefer exact `phone` match over `whatsappNumber` so a shared WhatsApp
 * number cannot steal another driver's login.
 */
export function findDriverForLoginPhone<
  T extends { phone: string; whatsappNumber: string },
>(drivers: T[], rawPhone: string): T | undefined {
  const phoneNorm = normalizePhone(rawPhone)
  if (!phoneNorm) return undefined

  const byPhone = drivers.find((d) => normalizePhone(d.phone) === phoneNorm)
  if (byPhone) return byPhone

  return drivers.find((d) => normalizePhone(d.whatsappNumber) === phoneNorm)
}

