export const BOOKING_FOCUS_FIELD_EVENT = "booking:focus-field"

export type BookingFieldId =
  | "destination"
  | "pickupDateTime"
  | "returnDateTime"
  | "quote"
  | "name"
  | "email"
  | "phone"
  | "flightNumber"
  | "terms"

export type BookingFieldFocusDetail = {
  field: BookingFieldId
  message?: string
}

export const BOOKING_FIELD_HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-destructive/40",
  "border-destructive",
  "bg-destructive/5",
] as const

export function dispatchBookingFieldFocus(detail: BookingFieldFocusDetail) {
  window.dispatchEvent(
    new CustomEvent(BOOKING_FOCUS_FIELD_EVENT, { detail }),
  )
}

export function highlightBookingField(
  el: HTMLElement | null,
  durationMs = 2500,
) {
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.setAttribute("aria-invalid", "true")
  el.classList.add(...BOOKING_FIELD_HIGHLIGHT_CLASSES)
  window.setTimeout(() => {
    el.classList.remove(...BOOKING_FIELD_HIGHLIGHT_CLASSES)
  }, durationMs)
}

export function focusBookingFieldElement(el: HTMLElement | null) {
  if (!el) return
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    el.focus({ preventScroll: true })
    return
  }
  const focusable = el.querySelector<HTMLElement>(
    "input, textarea, select, button, [tabindex]:not([tabindex='-1'])",
  )
  focusable?.focus({ preventScroll: true })
}

export function applyBookingFieldFocus(field: BookingFieldId) {
  const el = document.querySelector<HTMLElement>(
    `[data-booking-field="${field}"]`,
  )
  focusBookingFieldElement(el)
  highlightBookingField(el)
  return el
}

export function focusBookingTerms(message?: string) {
  dispatchBookingFieldFocus({ field: "terms", message })
}
