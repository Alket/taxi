import webpush from "web-push"

import { prisma } from "@/lib/db"

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
  void sendStaffPush("admin", {
    title: "New booking",
    body: `${args.referenceCode}${customer}\n${args.pickupAddress} → ${args.dropoffAddress}`,
    url: `/admin/bookings?booking=${args.bookingId}`,
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
  void sendStaffPush(
    "driver",
    {
      title: "New trip — accept or reject",
      body: `${args.referenceCode}\n${args.pickupAddress} → ${args.dropoffAddress}${when}`,
      url: `/driver`,
      tag: `trip-${args.bookingId}`,
    },
    { ownerId: args.driverId },
  ).catch(() => {})
}

export function notifyAdminsDriverRejected(args: {
  bookingId: string
  referenceCode: string
  pickupAddress: string
  dropoffAddress: string
  driverName?: string
}) {
  const who = args.driverName ? `${args.driverName} rejected` : "Driver rejected"
  void sendStaffPush("admin", {
    title: "Trip rejected — reassign driver",
    body: `${args.referenceCode} · ${who}\n${args.pickupAddress} → ${args.dropoffAddress}`,
    url: `/admin/bookings?booking=${args.bookingId}`,
    tag: `reject-${args.bookingId}`,
  }).catch(() => {})
}
