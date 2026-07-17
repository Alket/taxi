import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCanDelete } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializePricingRule } from "@/lib/pricing-admin"

const positiveMoney = z.coerce.number().positive()

const createRuleSchema = z.object({
  zoneId: z.string().min(1),
  vehicleType: z.enum(["sedan", "comfort", "minivan", "premium"]),
  baseFare: positiveMoney,
  perKmRate: positiveMoney,
  minFare: positiveMoney,
})

const updateRuleSchema = z.object({
  id: z.string().min(1),
  baseFare: positiveMoney.optional(),
  perKmRate: positiveMoney.optional(),
  minFare: positiveMoney.optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const zoneId = searchParams.get("zoneId")

  const rules = await prisma.pricingRule.findMany({
    where: zoneId && zoneId !== "all" ? { zoneId } : undefined,
    include: {
      zone: {
        select: { name: true },
      },
    },
    orderBy: [{ zone: { name: "asc" } }, { vehicleType: "asc" }],
  })

  return NextResponse.json({
    rules: rules.map(serializePricingRule),
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = createRuleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pricing rule payload." },
      { status: 400 },
    )
  }

  const rule = await prisma.pricingRule.create({
    data: parsed.data,
    include: {
      zone: {
        select: { name: true },
      },
    },
  })

  return NextResponse.json(
    { rule: serializePricingRule(rule) },
    { status: 201 },
  )
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = updateRuleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pricing rule payload." },
      { status: 400 },
    )
  }

  const { id, ...data } = parsed.data

  const existing = await prisma.pricingRule.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Pricing rule not found." }, { status: 404 })
  }

  const rule = await prisma.pricingRule.update({
    where: { id },
    data,
    include: {
      zone: {
        select: { name: true },
      },
    },
  })

  return NextResponse.json({ rule: serializePricingRule(rule) })
}

export async function DELETE(request: Request) {
  const denied = await requireCanDelete()
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) {
    return NextResponse.json({ error: "Rule id is required." }, { status: 400 })
  }

  const existing = await prisma.pricingRule.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Pricing rule not found." }, { status: 404 })
  }

  await prisma.pricingRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

