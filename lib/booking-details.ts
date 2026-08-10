import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js"

import {
  isPickupTooSoon,
  pickupLeadTimeMessage,
} from "@/lib/pickup-lead-time"
import {
  bookerRelationSchema,
  type BookerRelation,
} from "@/lib/booker-relation"
import { z } from "zod"

/** IATA (2-char) or ICAO (3-letter) airline code + 1–4 digits, optional suffix (e.g. LH1445, EAF654, U2123). */
export const FLIGHT_NUMBER_RE =
  /^(?:[A-Za-z][A-Za-z0-9]|[A-Za-z]{3})\d{1,4}[A-Za-z]?$/

/** Shown first in the country-code picker (Albania + region). */
const PRIORITY_COUNTRIES: CountryCode[] = [
  "AL",
  "IT",
  "GR",
  "XK",
  "MK",
  "ME",
  "RS",
  "DE",
  "GB",
  "US",
]

export type PhoneCountryOption = {
  iso: CountryCode
  code: string
  name: string
  flag: string
  label: string
}

function countryFlag(iso: string) {
  return [...iso.toUpperCase()]
    .map((char) => String.fromCodePoint(0x1f1e6 - 65 + char.charCodeAt(0)))
    .join("")
}

let phoneCountryOptionsCache: PhoneCountryOption[] | null = null

/** Full dial-code list from libphonenumber-js (flag + name + calling code). */
export function getPhoneCountryOptions(): PhoneCountryOption[] {
  if (phoneCountryOptionsCache) return phoneCountryOptionsCache

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" })
  const priorityIndex = new Map(
    PRIORITY_COUNTRIES.map((iso, index) => [iso, index]),
  )

  const options = getCountries().map((iso) => {
    const code = `+${getCountryCallingCode(iso)}`
    const name = displayNames.of(iso) ?? iso
    const flag = countryFlag(iso)
    return {
      iso,
      code,
      name,
      flag,
      label: `${name} ${code}`,
    }
  })

  options.sort((a, b) => {
    const pa = priorityIndex.get(a.iso) ?? 999
    const pb = priorityIndex.get(b.iso) ?? 999
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })

  phoneCountryOptionsCache = options
  return options
}

export function normalizeFlightNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase()
}

/** Shared with bookingCreateSchema — keep client DetailsStep and server in sync. */
export const bookingCustomerNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(80, "Name is too long.")

export const bookingCustomerEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320)

/** Joined E.164-style value from joinPhone (e.g. +355691234567). */
export const bookingCustomerPhoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    const digits = value.replace(/\D/g, "")
    return digits.length >= 8 && digits.length <= 18
  }, "Enter a valid phone number.")
  .max(50)

export const bookingFlightNumberSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value == null ? "" : value))
  .refine(
    (value) => {
      if (!value) return true
      return FLIGHT_NUMBER_RE.test(normalizeFlightNumber(value))
    },
    "Use a format like LH1445 or EAF654.",
  )

export const bookingPassengerNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the passenger's full name.")
  .max(80, "Name is too long.")

export const bookingPassengerEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid passenger email.")
  .max(320)

const phoneNationalSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number.")
  .max(15, "Phone number is too long.")
  .regex(/^\d[\d\s-]*$/, "Phone number should contain digits only.")

export function createDetailsSchema(options: {
  isRoundTrip: boolean
  returnDateTime: string | null
}) {
  return z
    .object({
      pickupDateTime: z
        .string()
        .min(1, "Choose a pickup date and time.")
        .refine((value) => {
          const date = new Date(value)
          return !Number.isNaN(date.getTime())
        }, "Choose a valid pickup date and time.")
        .refine(
          (value) => !isPickupTooSoon(value),
          pickupLeadTimeMessage(),
        ),
      flightNumber: z
        .string()
        .trim()
        .min(1, "Enter your flight number.")
        .refine(
          (value) => FLIGHT_NUMBER_RE.test(normalizeFlightNumber(value)),
          "Use a format like LH1445 or EAF654.",
        ),
      bookedForOther: z.boolean(),
      // Booker (always required)
      name: bookingCustomerNameSchema,
      email: bookingCustomerEmailSchema,
      phoneCountryCode: z.string().min(2, "Select a country code."),
      phoneNational: phoneNationalSchema,
      // Passenger (validated when bookedForOther)
      passengerName: z.string().trim().max(80),
      passengerEmail: z.string().trim().max(320),
      passengerNoEmail: z.boolean(),
      passengerPhoneCountryCode: z.string().min(1),
      passengerPhoneNational: z.string().trim().max(15),
      bookerRelation: bookerRelationSchema.nullable(),
      whatsappOptIn: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (options.isRoundTrip && options.returnDateTime) {
        const pickup = new Date(data.pickupDateTime).getTime()
        const ret = new Date(options.returnDateTime).getTime()
        if (!Number.isNaN(pickup) && !Number.isNaN(ret) && ret <= pickup) {
          ctx.addIssue({
            code: "custom",
            path: ["pickupDateTime"],
            message:
              "Return pickup (from Step 2) must be after this outbound pickup.",
          })
        }
      }

      if (!data.bookedForOther) return

      const passengerName = bookingPassengerNameSchema.safeParse(
        data.passengerName,
      )
      if (!passengerName.success) {
        ctx.addIssue({
          code: "custom",
          path: ["passengerName"],
          message:
            passengerName.error.issues[0]?.message ??
            "Enter the passenger's full name.",
        })
      }

      if (!data.passengerNoEmail) {
        const passengerEmail = bookingPassengerEmailSchema.safeParse(
          data.passengerEmail,
        )
        if (!passengerEmail.success) {
          ctx.addIssue({
            code: "custom",
            path: ["passengerEmail"],
            message:
              passengerEmail.error.issues[0]?.message ??
              "Enter a valid passenger email.",
          })
        }
      }

      const passengerPhone = phoneNationalSchema.safeParse(
        data.passengerPhoneNational,
      )
      if (!passengerPhone.success) {
        ctx.addIssue({
          code: "custom",
          path: ["passengerPhoneNational"],
          message:
            passengerPhone.error.issues[0]?.message ??
            "Enter a valid passenger phone number.",
        })
      }

      if (
        !data.passengerPhoneCountryCode ||
        data.passengerPhoneCountryCode.length < 2
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["passengerPhoneCountryCode"],
          message: "Select a country code.",
        })
      }

      if (!data.bookerRelation) {
        ctx.addIssue({
          code: "custom",
          path: ["bookerRelation"],
          message: "Select your relation with the passenger.",
        })
      }
    })
}

export type DetailsFormValues = z.infer<ReturnType<typeof createDetailsSchema>>

export type { BookerRelation }

export function resolvePhoneCountryOption(
  countryCode: string,
): PhoneCountryOption {
  const options = getPhoneCountryOptions()
  return (
    options.find((entry) => entry.code === countryCode) ??
    options.find((entry) => entry.iso === "AL") ??
    options[0]!
  )
}

export function splitPhone(phone: string): {
  countryCode: string
  national: string
} {
  const trimmed = phone.trim()
  if (!trimmed) {
    return { countryCode: "+355", national: "" }
  }

  const options = [...getPhoneCountryOptions()].sort(
    (a, b) => b.code.length - a.code.length,
  )
  const match = options.find((entry) => trimmed.startsWith(entry.code))
  if (match) {
    return {
      countryCode: match.code,
      national: trimmed.slice(match.code.length).trim(),
    }
  }
  return { countryCode: "+355", national: trimmed.replace(/^\+/, "") }
}

export function joinPhone(countryCode: string, national: string) {
  const digits = national.replace(/[^\d]/g, "")
  return `${countryCode}${digits}`
}

export function toLocalInputValue(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInputValue(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
