import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCanDelete } from "@/lib/auth"
import { hashDriverPin } from "@/lib/driver-auth"
import { prisma } from "@/lib/db"
import { DRIVER_PUBLIC_SELECT, serializeDriver } from "@/lib/drivers"

const updateDriverSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  whatsappNumber: z.string().trim().max(50).optional(),
  vehicleMake: z.string().trim().max(100).optional(),
  vehicleModel: z.string().trim().max(100).optional(),
  plateNumber: z.string().trim().min(1).max(50).optional(),
  languages: z.array(z.string().trim().min(1).max(50)).optional(),
  vetted: z.boolean().optional(),
  active: z.boolean().optional(),
  pin: z.string().trim().min(4).max(12).optional().or(z.literal("")),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = updateDriverSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid driver payload." }, { status: 400 })
  }

  const driver = await prisma.driver.findUnique({ where: { id } })
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 })
  }

  const { pin, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (typeof pin === "string" && pin.trim().length >= 4) {
    data.pinHash = await hashDriverPin(pin.trim())
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 })
  }

  try {
    const updated = await prisma.driver.update({
      where: { id },
      data,
      select: DRIVER_PUBLIC_SELECT,
    })
    return NextResponse.json({ driver: serializeDriver(updated) })
  } catch {
    return NextResponse.json(
      { error: "Could not update driver. Plate number may already be in use." },
      { status: 409 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireCanDelete()
  if (denied) return denied

  const { id } = await params

  const driver = await prisma.driver.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          bookings: {
            where: {
              status: {
                notIn: ["cancelled", "completed"],
              },
            },
          },
        },
      },
    },
  })

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 })
  }

  if (driver._count.bookings > 0) {
    return NextResponse.json(
      {
        error:
          "This driver still has active bookings. Reassign or finish those trips first.",
      },
      { status: 409 },
    )
  }

  await prisma.driver.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
