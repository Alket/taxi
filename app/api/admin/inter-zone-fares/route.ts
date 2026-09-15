import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin, requireCanDelete, requireStaffSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canonicalZonePair, serializeInterZoneFare } from "@/lib/pricing-admin"
import { vehicleTypeSchema } from "@/lib/vehicles"

const positiveMoney = z.coerce.number().positive()

const createSchema = z
  .object({
    zoneAId: z.string().min(1),
    zoneBId: z.string().min(1),
    vehicleType: vehicleTypeSchema,
    baseFare: positiveMoney,
    minFare: positiveMoney,
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.zoneAId === data.zoneBId) {
      ctx.addIssue({
        code: "custom",
        path: ["zoneBId"],
        message: "Pick two different cities.",
      })
    }
  })

const updateSchema = z.object({
  id: z.string().min(1),
  baseFare: positiveMoney.optional(),
  minFare: positiveMoney.optional(),
  active: z.boolean().optional(),
})

const fareInclude = {
  zoneA: { select: { name: true } },
  zoneB: { select: { name: true } },
} as const

export async function GET(request: Request) {
  const session = await requireStaffSession(request)
  if ("error" in session) return session.error

  const fares = await prisma.interZoneFare.findMany({
    include: fareInclude,
    orderBy: [
      { zoneA: { name: "asc" } },
      { zoneB: { name: "asc" } },
      { vehicleType: "asc" },
    ],
  })

  return NextResponse.json({
    fares: fares.map(serializeInterZoneFare),
  })
}

export async function POST(request: Request) {
  const denied = await requireAdmin(
    "Your account cannot create city corridor fares. Ask an admin.",
  )
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid city corridor fare payload." },
      { status: 400 },
    )
  }

  const { zoneAId: rawA, zoneBId: rawB, vehicleType, baseFare, minFare } =
    parsed.data
  const { zoneAId, zoneBId } = canonicalZonePair(rawA, rawB)

  const [zoneA, zoneB] = await Promise.all([
    prisma.zone.findFirst({ where: { id: zoneAId, active: true } }),
    prisma.zone.findFirst({ where: { id: zoneBId, active: true } }),
  ])
  if (!zoneA || !zoneB) {
    return NextResponse.json(
      { error: "Both cities must be active zones." },
      { status: 400 },
    )
  }

  try {
    const fare = await prisma.interZoneFare.create({
      data: {
        zoneAId,
        zoneBId,
        vehicleType,
        baseFare,
        minFare,
        active: parsed.data.active ?? true,
      },
      include: fareInclude,
    })
    return NextResponse.json(
      { fare: serializeInterZoneFare(fare) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: "A fare already exists for this city pair and vehicle." },
      { status: 409 },
    )
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(
    "Your account cannot edit city corridor fares. Ask an admin.",
  )
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid city corridor fare payload." },
      { status: 400 },
    )
  }

  const { id, ...data } = parsed.data
  const existing = await prisma.interZoneFare.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Fare not found." }, { status: 404 })
  }

  const fare = await prisma.interZoneFare.update({
    where: { id },
    data,
    include: fareInclude,
  })

  return NextResponse.json({ fare: serializeInterZoneFare(fare) })
}

export async function DELETE(request: Request) {
  const denied = await requireCanDelete()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) {
    return NextResponse.json({ error: "Missing fare id." }, { status: 400 })
  }

  const existing = await prisma.interZoneFare.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Fare not found." }, { status: 404 })
  }

  await prisma.interZoneFare.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
