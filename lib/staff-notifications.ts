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

/** Fire-and-forget inbox write (never blocks booking flows). */
export function recordStaffNotification(input: CreateStaffNotificationInput) {
  void createStaffNotification(input).catch((err) => {
    console.error("[staff-notifications] failed to persist", err)
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
