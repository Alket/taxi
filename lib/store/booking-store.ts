import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { isPickupTooSoon } from "@/lib/pickup-lead-time"
import type { Direction, VehicleType } from "@/lib/types"

export type BookingStep = 1 | 2

export const BOOKING_STEPS = [
  { id: 1 as const, key: "transfers", label: "Transfers" },
  { id: 2 as const, key: "payment", label: "Payment" },
] as const

export const VEHICLE_TYPES: VehicleType[] = [
  "sedan",
  "comfort",
  "minivan",
  "premium",
]

export type BookingLocation = {
  address: string
  lat: number | null
  lng: number | null
}

export type BookingCustomerDraft = {
  name: string
  email: string
  phone: string
  whatsappOptIn: boolean
}

export type VehicleQuote = {
  price: number
  distanceKm: number
  durationMin: number
}

export type QuoteStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "uncovered"

export type BookingState = {
  direction: Direction | null
  selectedAirportIata: string | null
  /** Active pricing zone selected as the non-airport destination. */
  selectedZoneId: string | null
  pickup: BookingLocation
  dropoff: BookingLocation
  pickupDateTime: string | null
  flightNumber: string
  passengerCount: number
  luggageCount: number
  vehicleType: VehicleType | null
  isRoundTrip: boolean
  returnDateTime: string | null
  meetAndGreet: boolean
  infantCarrierCount: number
  childSeatCount: number
  boosterCount: number
  /** Optional message for the driver from the customer. */
  driverNotes: string
  quotedPrice: number | null
  quotedDistanceKm: number | null
  vehicleQuotes: Partial<Record<VehicleType, VehicleQuote>>
  quoteStatus: QuoteStatus
  quoteError: string | null
  customer: BookingCustomerDraft
  currentStep: BookingStep
  /**
   * True when the customer continued from the homepage hero form.
   * Hides route / date / passengers / luggage fields already collected there.
   */
  startedFromHero: boolean
  /** Set when Payment step creates the pending booking. */
  createdBookingId: string | null
  createdReferenceCode: string | null
  createdDepositAmount: number | null
  createdCurrency: string | null
}

type BookingActions = {
  setField: <K extends keyof BookingState>(
    key: K,
    value: BookingState[K],
  ) => void
  patch: (partial: Partial<BookingState>) => void
  setStep: (step: BookingStep) => void
  nextStep: () => boolean
  prevStep: () => void
  resetBooking: () => void
  clearQuotes: () => void
  canProceedToStep: (step: BookingStep) => boolean
}

export type BookingStore = BookingState & BookingActions

const emptyLocation = (): BookingLocation => ({
  address: "",
  lat: null,
  lng: null,
})

const initialCustomer = (): BookingCustomerDraft => ({
  name: "",
  email: "",
  phone: "",
  whatsappOptIn: true,
})

export const initialBookingState: BookingState = {
  direction: "airport_to_dest",
  selectedAirportIata: null,
  selectedZoneId: null,
  pickup: emptyLocation(),
  dropoff: emptyLocation(),
  pickupDateTime: null,
  flightNumber: "",
  passengerCount: 1,
  luggageCount: 0,
  vehicleType: null,
  isRoundTrip: false,
  returnDateTime: null,
  meetAndGreet: false,
  infantCarrierCount: 0,
  childSeatCount: 0,
  boosterCount: 0,
  driverNotes: "",
  quotedPrice: null,
  quotedDistanceKm: null,
  vehicleQuotes: {},
  quoteStatus: "idle",
  quoteError: null,
  customer: initialCustomer(),
  currentStep: 1,
  startedFromHero: false,
  createdBookingId: null,
  createdReferenceCode: null,
  createdDepositAmount: null,
  createdCurrency: null,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function hasLocation(location: BookingLocation) {
  return (
    location.address.trim().length > 0 &&
    location.lat !== null &&
    location.lng !== null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  )
}

function hasSuccessfulQuotes(state: BookingState) {
  if (state.quoteStatus !== "success") return false
  // A zone may only have pricing for some vehicles — one valid quote is enough.
  return VEHICLE_TYPES.some((type) => {
    const quote = state.vehicleQuotes[type]
    return quote != null && quote.price >= 0
  })
}

function isRouteComplete(state: BookingState) {
  if (!state.direction) return false
  if (!state.selectedZoneId || !state.selectedAirportIata) return false
  const airportEnd =
    state.direction === "airport_to_dest" ? state.pickup : state.dropoff
  const destinationEnd =
    state.direction === "airport_to_dest" ? state.dropoff : state.pickup
  if (!hasLocation(airportEnd)) return false
  if (!destinationEnd.address.trim()) return false
  if (!state.pickupDateTime) return false
  if (isPickupTooSoon(state.pickupDateTime)) return false
  if (!hasSuccessfulQuotes(state)) return false
  return true
}

function isVehicleComplete(state: BookingState) {
  if (state.vehicleType === null) return false
  if (state.quotedPrice === null || state.quotedPrice < 0) return false
  if (state.isRoundTrip && !state.returnDateTime) return false
  return true
}

function isDetailsComplete(state: BookingState) {
  if (!state.pickupDateTime) return false
  if (isPickupTooSoon(state.pickupDateTime)) return false

  if (state.isRoundTrip) {
    if (!state.returnDateTime) return false
    const pickupMs = new Date(state.pickupDateTime).getTime()
    const returnMs = new Date(state.returnDateTime).getTime()
    if (Number.isNaN(returnMs) || returnMs <= pickupMs) return false
  }

  const flight = state.flightNumber.trim()
  if (flight) {
    const normalized = flight.replace(/[\s-]/g, "").toUpperCase()
    if (!/^[A-Z]{2}\d{1,4}$/.test(normalized)) return false
  }

  const { name, email, phone } = state.customer
  if (!name.trim() || name.trim().length < 2) return false
  if (!email.trim() || !EMAIL_RE.test(email.trim())) return false
  if (!phone.trim() || phone.replace(/\D/g, "").length < 8) return false
  return true
}

export function canProceedToStep(
  state: BookingState,
  step: BookingStep,
): boolean {
  if (step <= 1) return true
  // Step 2 (Payment) needs route quotes, auto-selected vehicle, and contact details.
  if (!isRouteComplete(state)) return false
  if (!isVehicleComplete(state)) return false
  if (!isDetailsComplete(state)) return false
  return true
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set, get) => ({
      ...initialBookingState,

      setField(key, value) {
        set({ [key]: value } as Partial<BookingState>)
      },

      patch(partial) {
        set(partial)
      },

      setStep(step) {
        if (!get().canProceedToStep(step) && step > get().currentStep) return
        set({ currentStep: step })
      },

      nextStep() {
        const { currentStep, canProceedToStep: canProceed } = get()
        if (currentStep >= 2) return false
        const next = (currentStep + 1) as BookingStep
        if (!canProceed(next)) return false
        set({ currentStep: next })
        return true
      },

      prevStep() {
        const { currentStep } = get()
        if (currentStep <= 1) return
        set({ currentStep: (currentStep - 1) as BookingStep })
      },

      clearQuotes() {
        set({
          vehicleQuotes: {},
          quoteStatus: "idle",
          quoteError: null,
          quotedPrice: null,
          quotedDistanceKm: null,
          vehicleType: null,
        })
      },

      resetBooking() {
        set({
          ...initialBookingState,
          customer: initialCustomer(),
          pickup: emptyLocation(),
          dropoff: emptyLocation(),
          vehicleQuotes: {},
        })
      },

      canProceedToStep(step) {
        return canProceedToStep(get(), step)
      },
    }),
    {
      name: "booking-draft-v1",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      version: 2,
      migrate: (persisted) => {
        const state = { ...(persisted as Record<string, unknown>) }
        const step = state.currentStep
        // Legacy 4-step wizard → 2-step (transfers / payment).
        if (step === 4) state.currentStep = 2
        else if (step === 2 || step === 3 || (typeof step === "number" && step > 2)) {
          state.currentStep = 1
        }
        return state as unknown as BookingState
      },
      partialize: (state) => ({
        direction: state.direction,
        selectedAirportIata: state.selectedAirportIata,
        selectedZoneId: state.selectedZoneId,
        pickup: state.pickup,
        dropoff: state.dropoff,
        pickupDateTime: state.pickupDateTime,
        flightNumber: state.flightNumber,
        passengerCount: state.passengerCount,
        luggageCount: state.luggageCount,
        vehicleType: state.vehicleType,
        isRoundTrip: state.isRoundTrip,
        returnDateTime: state.returnDateTime,
        meetAndGreet: state.meetAndGreet,
        infantCarrierCount: state.infantCarrierCount,
        childSeatCount: state.childSeatCount,
        boosterCount: state.boosterCount,
        driverNotes: state.driverNotes,
        quotedPrice: state.quotedPrice,
        quotedDistanceKm: state.quotedDistanceKm,
        vehicleQuotes: state.vehicleQuotes,
        quoteStatus: state.quoteStatus,
        quoteError: state.quoteError,
        customer: state.customer,
        currentStep: state.currentStep,
        startedFromHero: state.startedFromHero,
        createdBookingId: state.createdBookingId,
        createdReferenceCode: state.createdReferenceCode,
        createdDepositAmount: state.createdDepositAmount,
        createdCurrency: state.createdCurrency,
      }),
    },
  ),
)
