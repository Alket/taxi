export type Direction = "airport_to_dest" | "dest_to_airport"

export type FlightStatus =
  | "scheduled"
  | "on_time"
  | "delayed"
  | "landed"
  | "cancelled"

export type PaymentStatus =
  | "unpaid"
  | "deposit_paid"
  | "paid"
  | "fully_paid"
  | "refunded"
  | "failed"

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "driver_assigned"
  | "driver_accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"

export type VehicleType = "sedan" | "comfort" | "minivan" | "premium"

export interface Customer {
  name: string
  email: string
  phone: string
}

export interface BookingDriver {
  name: string
  phone: string
  plateNumber: string
}

export type CancellationOutcome = "free_cancellation" | "deposit_forfeited"

export interface StatusEvent {
  status: BookingStatus
  timestamp: string | null
}

export interface PaymentRecord {
  id: string
  type: "deposit" | "balance"
  amount: number
  currency: string
  status: PaymentStatus
  provider: string
  externalId: string | null
  paidAt: string | null
  createdAt: string
}

export interface Booking {
  id: string
  referenceCode: string
  pickupPin: string
  direction: Direction
  pickupAddress: string
  dropoffAddress: string
  pickupDateTime: string
  flightNumber: string
  flightStatus: FlightStatus
  passengerCount: number
  luggageCount: number
  vehicleType: VehicleType
  totalPrice: number
  depositAmount: number
  depositPaid: number
  balanceDue: number
  isBalanceCharged: boolean
  balanceChargedAt: string | null
  balanceChargedBy: string | null
  paymentStatus: PaymentStatus
  status: BookingStatus
  customer: Customer
  driver: BookingDriver | null
  driverId: string | null
  currency: string
  freeCancellationUntil: string
  cancelledAt: string | null
  cancellationOutcome: CancellationOutcome | null
  timeline: StatusEvent[]
  notes?: string
}

export interface BookingDetail extends Booking {
  payments: PaymentRecord[]
}

export interface Driver {
  id: string
  name: string
  phone: string
  whatsappNumber: string
  vehicleMake: string
  vehicleModel: string
  plateNumber: string
  languages: string[]
  vetted: boolean
  active: boolean
  avgRating: number
  /** True when a dashboard PIN has been set (hash is never returned). */
  pinSet: boolean
}

export interface Zone {
  id: string
  name: string
}

export interface PricingRule {
  id: string
  zoneId: string
  zoneName: string
  vehicleType: VehicleType
  baseFare: number
  perKmRate: number
  minFare: number
  currency: string
}

export interface DashboardSummary {
  bookingsToday: number
  bookingsThisWeek: number
  unassignedCount: number
  revenueThisMonth: number
  currency: string
  upcomingUrgent: Booking[]
}

export type DisplayCurrency = "EUR" | "USD" | "GBP"

export type PaymentMode = "test" | "live"

export type PaymentOption = "deposit" | "full"

export type ConnectionStatus = "connected" | "disconnected"

export interface AirportEntry {
  name: string
  iataCode: string
}

export interface NotificationChannels {
  confirmation: boolean
  driverAssigned: boolean
  flightDelay: boolean
  reminder: boolean
  cancellation: boolean
}

export interface Settings {
  companyName: string
  supportPhone: string
  supportEmail: string
  supportWhatsApp: string
  displayCurrencies: DisplayCurrency[]
  freeCancellationHours: number
  depositPercentage: number
  roundTripDiscountPercent: number
  infantCarrierPrice: number
  childSeatPrice: number
  boosterSeatPrice: number
  stripeEnabled: boolean
  paypalEnabled: boolean
  cashOnArrivalEnabled: boolean
  depositPaymentEnabled: boolean
  fullPaymentEnabled: boolean
  airports: AirportEntry[]
  notificationChannelsEnabled: NotificationChannels
  flightDelayThresholdMinutes: number
  whatsappConnectionStatus: ConnectionStatus
  stripeMode: PaymentMode
  paypalMode: PaymentMode
  /** Stripe publishable keys are safe to return; secrets are flags only. */
  stripeTestPublishableKey: string
  stripeLivePublishableKey: string
  stripeTestSecretKeySet: boolean
  stripeLiveSecretKeySet: boolean
  stripeTestWebhookSecretSet: boolean
  stripeLiveWebhookSecretSet: boolean
  /** PayPal client IDs are not secret; secrets are never returned, only flags. */
  paypalSandboxClientId: string
  paypalLiveClientId: string
  paypalSandboxSecretSet: boolean
  paypalLiveSecretSet: boolean
}

export type AdminRole = "admin" | "operator"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  suspended: boolean
  lastLoginAt: string | null
  requiresPasswordReset: boolean
}
