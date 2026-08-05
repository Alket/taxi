import { prisma } from "@/lib/db"

export type StaffNotificationType =
  | "new_booking"
  | "payment"
  | "driver_rejected"
  | "driver_accepted"
  | "driver_assigned"
  | "driver_arrived"
  | "cash_paid"
  | "trip_completed"
  | "new_review"
  | "date_change"
  | "booking_cancelled"

export type CreateStaffNotificationInput = {
  audience: "admin" | "driver"
  ownerId?: string | null
  type: StaffNotificationType
  title: string
  body: string
  url: string
  bookingId?: string | null
}

export async function createStaffNotification(
  input: CreateStaffNotificationInput,
) {
  return prisma.staffNotification.create({
    data: {
      audience: input.audience,
      ownerId: input.ownerId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url,
      bookingId: input.bookingId ?? null,
    },
  })
}

/**
 * Prefer updating an unread row for the same booking+type so repeated
 * customer edits (e.g. date_change) do not flood the admin inbox.
 */
export async function createOrCoalesceStaffNotification(
  input: CreateStaffNotificationInput,
) {
  if (input.bookingId) {
    const existing = await prisma.staffNotification.findFirst({
      where: {
        audience: input.audience,
        type: input.type,
        bookingId: input.bookingId,
        ownerId: input.ownerId ?? null,
        readAt: null,
      },
      orderBy: { createdAt: "desc" },
    })
    if (existing) {
      return prisma.staffNotification.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          body: input.body,
          url: input.url,
          createdAt: new Date(),
        },
      })
    }
  }
  return createStaffNotification(input)
}

/** Fire-and-forget inbox write (never blocks booking flows). */
export function recordStaffNotification(input: CreateStaffNotificationInput) {
  void createStaffNotification(input).catch((err) => {
    console.error("[staff-notifications] failed to persist", err)
  })
}

/** Fire-and-forget coalesced inbox write (never blocks booking flows). */
export function recordCoalescedStaffNotification(
  input: CreateStaffNotificationInput,
) {
  void createOrCoalesceStaffNotification(input).catch((err) => {
    console.error("[staff-notifications] failed to persist (coalesce)", err)
  })
}

export function serializeStaffNotification(row: {
  id: string
  type: string
  title: string
  body: string
  url: string
  bookingId: string | null
  readAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    bookingId: row.bookingId,
    read: Boolean(row.readAt),
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
