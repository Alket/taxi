"use client"

import * as React from "react"

import {
  applyBookingFieldFocus,
  BOOKING_FOCUS_FIELD_EVENT,
  type BookingFieldFocusDetail,
  type BookingFieldId,
} from "@/lib/booking-field-focus"

/** Listen for booking validation focus events scoped to /book. */
export function useBookingFieldFocusListener(
  field: BookingFieldId,
  onFocus?: (message?: string) => void,
) {
  const onFocusRef = React.useRef(onFocus)
  onFocusRef.current = onFocus

  React.useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<BookingFieldFocusDetail>).detail
      if (detail?.field !== field) return
      onFocusRef.current?.(detail.message)
      applyBookingFieldFocus(field)
    }

    window.addEventListener(BOOKING_FOCUS_FIELD_EVENT, handler)
    return () =>
      window.removeEventListener(BOOKING_FOCUS_FIELD_EVENT, handler)
  }, [field])
}
