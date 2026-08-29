import type { AdminUser, InternalNoteAction, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export type InternalNoteActor = Pick<AdminUser, "id" | "name">

function classifyAction(
  previous: string | null | undefined,
  next: string | null,
): InternalNoteAction {
  const had = Boolean(previous?.trim())
  const has = Boolean(next?.trim())
  if (!had && has) return "created"
  if (had && !has) return "deleted"
  return "updated"
}

/**
 * Persist the current staff-only note and an append-only history row.
 * Callers must already enforce role rules (operators cannot clear).
 */
export async function applyInternalNotesChange(input: {
  bookingId: string
  nextNotes: string | null
  actor: InternalNoteActor
}): Promise<void> {
  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, internalNotes: true },
  })
  if (!existing) {
    throw new Error("BOOKING_NOT_FOUND")
  }

  const previousText = existing.internalNotes ?? null
  const nextText = input.nextNotes?.trim() ? input.nextNotes.trim() : null
  const prevNorm = previousText?.trim() || null
  const nextNorm = nextText

  if (prevNorm === nextNorm) {
    return
  }

  const action = classifyAction(previousText, nextText)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        internalNotes: nextText,
        internalNotesUpdatedAt: now,
        internalNotesUpdatedById: input.actor.id,
      },
    })
    await tx.bookingInternalNoteEvent.create({
      data: {
        bookingId: input.bookingId,
        actorId: input.actor.id,
        actorName: input.actor.name,
        action,
        previousText,
        nextText,
      },
    })
  })
}

export type InternalNoteHistoryRecord = Prisma.BookingInternalNoteEventGetPayload<{
  select: {
    id: true
    action: true
    actorName: true
    actorId: true
    previousText: true
    nextText: true
    createdAt: true
  }
}>

export const internalNoteHistorySelect = {
  id: true,
  action: true,
  actorName: true,
  actorId: true,
  previousText: true,
  nextText: true,
  createdAt: true,
} satisfies Prisma.BookingInternalNoteEventSelect

export const INTERNAL_NOTE_HISTORY_LIMIT = 50
