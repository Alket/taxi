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
  | "abandoned"

export type VehicleType = "sedan" | "minivan"

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

export type BookerRelation =
  | "family_friend"
  | "travel_agent"
  | "colleague"
  | "prefer_not_to_say"

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
  createdAt: string
  timeline: StatusEvent[]
  notes?: string
  bookedForOther: boolean
  passengerName: string | null
  passengerEmail: string | null
  passengerPhone: string | null
  passengerNoEmail: boolean
  bookerRelation: BookerRelation | null
  /**
   * Staff-only driver/subcontractor cost (admin list + detail).
   * Never exposed on public/driver APIs.
   */
  driverCost?: number | null
  /** Staff-only: totalPrice − driverCost when cost is set; otherwise null. */
  profit?: number | null
  /** Staff-only: office received company profit cash from the driver. */
  profitCollected?: boolean
  profitCollectedAt?: string | null
  profitCollectedBy?: { id: string; name: string } | null
  /**
   * Frozen profit at mark time (totalPrice − driverCost then).
   * Prefer this over live `profit` when profitCollected is true.
   */
  profitCollectedAmount?: number | null
}

export type InternalNoteAction = "created" | "updated" | "deleted"

export interface InternalNoteHistoryItem {
  id: string
  action: InternalNoteAction
  actorName: string
  actorId: string | null
  previousText: string | null
  nextText: string | null
  createdAt: string
}

export type DriverCostAction = "created" | "updated" | "deleted"

export interface DriverCostHistoryItem {
  id: string
  action: DriverCostAction
  actorName: string
  actorId: string | null
  previousAmount: number | null
  nextAmount: number | null
  createdAt: string
}

export interface BookingDetail extends Booking {
  payments: PaymentRecord[]
  /** Staff-only; never shown to customers or drivers. Detail only — not list. */
  internalNotes?: string | null
  internalNotesUpdatedAt?: string | null
  internalNotesUpdatedBy?: { id: string; name: string } | null
  internalNoteHistory?: InternalNoteHistoryItem[]
  driverCostUpdatedAt?: string | null
  driverCostUpdatedBy?: { id: string; name: string } | null
  /** Admin-only audit trail. Operators receive empty array. */
  driverCostHistory?: DriverCostHistoryItem[]
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
  /** Sum of depositPaid on completed trips with pickup this month. */
  revenueThisMonth: number
  revenueThisMonthTripCount: number
  /** Sum of (totalPrice − driverCost) for pickups this month with driver cost set. */
  profitThisMonth: number
  profitThisMonthTripCount: number
  currency: string
  upcomingUrgent: Booking[]
  /** Completed trips with driver cost set but profit not marked collected. */
  uncollectedProfitCount: number
  uncollectedProfitTotal: number
  uncollectedProfit: Booking[]
}

export interface AnalyticsProviderRow {
  provider: string
  providerLabel: string
  amount: number
  amountLabel: string
  count: number
}

export interface AnalyticsDriverRevenueRow {
  driverId: string | null
  driverName: string
  cashCollected: number
  cashCollectedLabel: string
  onlineCollected: number
  onlineCollectedLabel: string
  totalCollected: number
  totalCollectedLabel: string
  tripCount: number
  shareOfCash: number
}

/** @deprecated Use AnalyticsDriverRevenueRow */
export type AnalyticsDriverCashRow = AnalyticsDriverRevenueRow

export interface AnalyticsDriverRouteRow {
  driverId: string | null
  driverName: string
  zoneId: string | null
  routeLabel: string
  cashCollected: number
  cashCollectedLabel: string
  onlineCollected: number
  onlineCollectedLabel: string
  totalCollected: number
  totalCollectedLabel: string
  tripCount: number
}

export interface AnalyticsDailyPoint {
  date: string
  total: number
  cash: number
  online: number
}

export interface AnalyticsBreakdownRow {
  key: string
  label: string
  amount: number
  amountLabel: string
  count: number
}

export interface AnalyticsReport {
  dateFrom: string
  dateTo: string
  currency: string
  driverFilter: {
    driverId: string | null
    driverName: string
  } | null
  summary: {
    totalCollected: number
    totalCollectedLabel: string
    cashCollected: number
    cashCollectedLabel: string
    onlineCollected: number
    onlineCollectedLabel: string
    paymentCount: number
    completedTripCount: number
    forfeitedDeposits: number
    forfeitedDepositsLabel: string
    /** Sum of (totalPrice − driverCost) for trips with driver cost in range. */
    profit: number
    profitLabel: string
    profitTripCount: number
  }
  outstanding: {
    unpaidBalances: number
    unpaidBalancesLabel: string
    unpaidTripCount: number
  }
  byProvider: AnalyticsProviderRow[]
  /** Driver totals: cash + online */
  revenueByDriver: AnalyticsDriverRevenueRow[]
  /** Per driver and destination route */
  revenueByDriverRoute: AnalyticsDriverRouteRow[]
  /** @deprecated Use revenueByDriver */
  cashByDriver: AnalyticsDriverRevenueRow[]
  dailySeries: AnalyticsDailyPoint[]
  byZone: AnalyticsBreakdownRow[]
  byVehicle: AnalyticsBreakdownRow[]
}

/** Driver-portal analytics (scoped to the logged-in driver). */
export interface DriverAnalyticsReport {
  dateFrom: string
  dateTo: string
  currency: string
  driver: {
    id: string
    name: string
  }
  summary: {
    totalCollected: number
    totalCollectedLabel: string
    cashCollected: number
    cashCollectedLabel: string
    onlineCollected: number
    onlineCollectedLabel: string
    paymentCount: number
    tripCount: number
  }
  byRoute: Array<{
    zoneId: string | null
    routeLabel: string
    cashCollected: number
    cashCollectedLabel: string
    onlineCollected: number
    onlineCollectedLabel: string
    totalCollected: number
    totalCollectedLabel: string
    tripCount: number
  }>
  dailySeries: AnalyticsDailyPoint[]
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
  dateChange: boolean
  completedReceipt: boolean
  reviewRequest: boolean
  checkoutAbandoned: boolean
}

export interface Settings {
  companyName: string
  supportPhone: string
  supportEmail: string
  supportWhatsApp: string
  /** Ops inbox for new/cancel/date-change emails. Empty → supportEmail. */
  adminNotificationEmail: string
  /** Public favicon URL. Empty → /marketing/favicon.png. */
  faviconUrl: string
  /** When false, site is noindex and robots.txt blocks crawlers. */
  searchIndexingEnabled: boolean
  /** Google Tag Manager container ID (GTM-XXXX). Empty → not installed. */
  gtmContainerId: string
  displayCurrencies: DisplayCurrency[]
  freeCancellationHours: number
  depositPercentage: number
  roundTripDiscountPercent: number
  infantCarrierPrice: number
  childSeatPrice: number
  boosterSeatPrice: number
  /** Max passengers for Sedan (booking auto-select + validation). */
  sedanSeats: number
  sedanLuggage: number
  minivanSeats: number
  minivanLuggage: number
  /** When false, Sedan is hidden from public booking and rejected on create/quote. */
  sedanEnabled: boolean
  /** When false, Minivan is hidden from public booking and rejected on create/quote. */
  minivanEnabled: boolean
  stripeEnabled: boolean
  paypalEnabled: boolean
  pokEnabled: boolean
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
  /** POK: key ids and merchant ids are returned; key secrets are flags only. */
  pokMode: PaymentMode
  pokStagingKeyId: string
  pokStagingMerchantId: string
  pokStagingKeySecretSet: boolean
  pokLiveKeyId: string
  pokLiveMerchantId: string
  pokLiveKeySecretSet: boolean
  /** SMTP host/user/from are returned; password is a flag only. */
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpFrom: string
  smtpTlsRejectUnauthorized: boolean
  smtpPassSet: boolean
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
