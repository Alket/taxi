import { z } from "zod"

export const BOOKER_RELATION_VALUES = [
  "family_friend",
  "travel_agent",
  "colleague",
  "prefer_not_to_say",
] as const

export type BookerRelation = (typeof BOOKER_RELATION_VALUES)[number]

export const bookerRelationSchema = z.enum(BOOKER_RELATION_VALUES)

export const BOOKER_RELATION_LABELS: Record<BookerRelation, string> = {
  family_friend: "Family or friend",
  travel_agent: "Travel agent",
  colleague: "Colleague or business administration",
  prefer_not_to_say: "I don't want to answer",
}

/** Traveler name for meet & greet / ops — passenger when booking for someone else. */
export function travelerDisplayName(booking: {
  bookedForOther?: boolean | null
  passengerName?: string | null
  customer: { name: string }
}): string {
  if (booking.bookedForOther && booking.passengerName?.trim()) {
    return booking.passengerName.trim()
  }
  return booking.customer.name
}
