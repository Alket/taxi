import type { DriverLocale } from "@/lib/i18n/driver"
import { APP_TIMEZONE } from "@/lib/timezone"

export type DriverBookingInfoSource = {
  referenceCode: string
  pickupPin: string
  contactName: string
  flightNumber: string | null
  passengerCount: number
  luggageCount: number
  driverNotes: string | null
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  totalPriceLabel: string
}

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string

const SQ_WEEKDAYS = [
  "e diel",
  "e hënë",
  "e martë",
  "e mërkurë",
  "e enjte",
  "e premte",
  "e shtunë",
] as const

const SQ_MONTHS = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
] as const

/** Parts of `value` in Europe/Tirane (weekday 0=Sun … 6=Sat). */
function tiraneParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value))

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""

  const weekdayKey = get("weekday") // Sun … Sat
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekdayKey,
  )

  return {
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : 0,
    day: Number(get("day")),
    monthIndex: Number(get("month")) - 1,
    hour: get("hour").padStart(2, "0"),
    minute: get("minute").padStart(2, "0"),
  }
}

/** Long pickup time for WhatsApp paste (e.g. sq "E diel, 30 gusht në 14:01"). */
export function formatDriverBookingInfoDateTime(
  value: string,
  locale: DriverLocale,
): string {
  if (locale === "sq") {
    const p = tiraneParts(value)
    const weekday = SQ_WEEKDAYS[p.weekdayIndex] ?? SQ_WEEKDAYS[0]
    const month = SQ_MONTHS[p.monthIndex] ?? SQ_MONTHS[0]
    const raw = `${weekday}, ${p.day} ${month} në ${p.hour}:${p.minute}`
    return raw.charAt(0).toLocaleUpperCase("sq-AL") + raw.slice(1)
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).format(new Date(value))
}

function line(label: string, value: string | number): string {
  return `${label}: ${value}`
}

/**
 * Plain-text booking summary for clipboard → WhatsApp.
 * Optional fields (flight, passenger comment) are omitted when empty.
 */
export function buildDriverBookingInfoText(
  trip: DriverBookingInfoSource,
  t: Translate,
  locale: DriverLocale,
): string {
  const blocks: string[][] = [
    [t("trips.copyHeading")],
    [
      line(t("trips.copyReference"), trip.referenceCode),
      line(t("trips.pickupPin"), trip.pickupPin),
    ],
  ]

  const passengerBlock = [
    line(t("trips.passenger"), trip.contactName),
  ]
  if (trip.flightNumber?.trim()) {
    passengerBlock.push(
      line(t("trips.copyFlightNumber"), trip.flightNumber.trim()),
    )
  }
  passengerBlock.push(
    line(t("calendar.sheetPassengers"), trip.passengerCount),
    line(t("calendar.sheetLuggage"), trip.luggageCount),
  )
  if (trip.driverNotes?.trim()) {
    passengerBlock.push(
      line(t("trips.passengerComment"), trip.driverNotes.trim()),
    )
  }
  blocks.push(passengerBlock)

  blocks.push([
    line(t("trips.pickup"), trip.pickupAddress),
    line(t("trips.dropoff"), trip.dropoffAddress),
    line(
      t("trips.copyPickupTime"),
      formatDriverBookingInfoDateTime(trip.pickupDateTime, locale),
    ),
  ])

  blocks.push([line(t("trips.copyTotal"), trip.totalPriceLabel)])

  return blocks.map((block) => block.join("\n")).join("\n\n")
}
