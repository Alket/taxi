import webpush from "web-push"

import { prisma } from "@/lib/db"
import { recordStaffNotification } from "@/lib/staff-notifications"

export type PushAudience = "admin" | "driver"

export type StaffPushPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || null
}

function vapidConfigured() {
  return Boolean(cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && cleanEnv(process.env.VAPID_PRIVATE_KEY))
}

export function getVapidPublicKey() {
  return cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
}

function ensureWebPush() {
  const publicKey = cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const privateKey = cleanEnv(process.env.VAPID_PRIVATE_KEY)
  const subject =
    cleanEnv(process.env.VAPID_SUBJECT) || "mailto:ops@transfers.co"

  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function savePushSubscription(input: {
  endpoint: string
  keys: { p256dh: string; auth: string }
  audience: PushAudience
  ownerId?: string | null
  userAgent?: string | null
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      audience: input.audience,
      ownerId: input.ownerId ?? null,
      userAgent: input.userAgent ?? null,
    },
    update: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      audience: input.audience,
      ownerId: input.ownerId ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

export async function deletePushSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
}

export async function sendStaffPush(
  audience: PushAudience,
  payload: StaffPushPayload,
  opts?: { ownerId?: string | null },
) {
  if (!vapidConfigured() || !ensureWebPush()) {
    return { sent: 0, skipped: true as const }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      audience,
      ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}),
    },
  })

  if (subscriptions.length === 0) {
    return { sent: 0, skipped: false as const }
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? "staff-alert",
  })

  let sent = 0
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 },
        )
        sent += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // Gone / expired subscription — clean up.
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {})
        }
      }
    }),
  )

  return { sent, skipped: false as const }
}

/** Fire-and-forget staff alert (never blocks booking flows). */
export function notifyAdminsNewBooking(args: {
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  customerName?: string
  bookingId: string
}) {
  const customer = args.customerName ? ` · ${args.customerName}` : ""
  const title = "New booking"
  const body = `${args.referenceCode}${customer}\n${args.pickupAddress} → ${args.dropoffAddress}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "new_booking",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `booking-${args.bookingId}`,
  }).catch(() => {})
}

export function notifyDriverAssigned(args: {
  driverId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  pickupLabel?: string
  bookingId: string
}) {
  const when = args.pickupLabel ? `\n${args.pickupLabel}` : ""
  const title = "New trip — accept or reject"
  const body = `${args.referenceCode}\n${args.pickupAddress} → ${args.dropoffAddress}${when}`
  const url = `/driver?bookingId=${encodeURIComponent(args.bookingId)}`

  recordStaffNotification({
    audience: "driver",
    ownerId: args.driverId,
    type: "driver_assigned",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush(
    "driver",
    {
      title,
      body,
      url,
      tag: `trip-${args.bookingId}`,
    },
    { ownerId: args.driverId },
  ).catch(() => {})
}

export function notifyAdminsDriverAccepted(args: {
  bookingId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  driverName?: string
}) {
  const who = args.driverName ? args.driverName : "Driver"
  const title = "Driver accepted trip"
  const body = `${args.referenceCode} · ${who}\n${args.pickupAddress} → ${args.dropoffAddress}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "driver_accepted",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `accept-${args.bookingId}`,
  }).catch(() => {})
}

export function notifyAdminsDriverRejected(args: {
  bookingId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  driverName?: string
}) {
  const who = args.driverName ? `${args.driverName} rejected` : "Driver rejected"
  const title = "Trip rejected — reassign driver"
  const body = `${args.referenceCode} · ${who}\n${args.pickupAddress} → ${args.dropoffAddress}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "driver_rejected",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `reject-${args.bookingId}`,
  }).catch(() => {})
}

export function notifyAdminsDriverArrived(args: {
  bookingId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  driverName?: string
}) {
  const who = args.driverName ?? "Driver"
  const title = "Driver marked arrived"
  const body = `${args.referenceCode} · ${who}\n${args.pickupAddress} → ${args.dropoffAddress}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "driver_arrived",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `arrived-${args.bookingId}`,
  }).catch(() => {})
}

export function notifyAdminsCashPaid(args: {
  bookingId: string
  referenceCode: string
  amount: number
  currency?: string
  driverName?: string
}) {
  const who = args.driverName ?? "Driver"
  const amountLabel =
    args.currency != null
      ? `${args.amount.toFixed(2)} ${args.currency}`
      : args.amount.toFixed(2)
  const title = "Cash paid confirmed"
  const body = `${args.referenceCode} · ${who} collected ${amountLabel}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "cash_paid",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `cash-${args.bookingId}`,
  }).catch(() => {})
}

export function notifyAdminsTripCompleted(args: {
  bookingId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  driverName?: string
}) {
  const who = args.driverName ?? "Driver"
  const title = "Trip completed"
  const body = `${args.referenceCode} · ${who}\n${args.pickupAddress} → ${args.dropoffAddress}`
  const url = `/admin/bookings?bookingId=${args.bookingId}`

  recordStaffNotification({
    audience: "admin",
    type: "trip_completed",
    title,
    body,
    url,
    bookingId: args.bookingId,
  })

  void sendStaffPush("admin", {
    title,
    body,
    url,
    tag: `completed-${args.bookingId}`,
  }).catch(() => {})
}
