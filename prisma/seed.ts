import {
  BookingStatus,
  Direction,
  FlightStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  VehicleType,
} from "@prisma/client"

import { hashPassword } from "../lib/auth"

const prisma = new PrismaClient()

const ADMIN_EMAIL = "ops@transfers.co"
const ADMIN_PASSWORD = "admin123"

const STATUS_ORDER: BookingStatus[] = [
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
]

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return date
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

function buildStatusEvents(
  status: BookingStatus,
  pickupAt: Date,
): { status: BookingStatus; timestamp: Date }[] {
  if (status === "cancelled") {
    return [
      { status: "pending", timestamp: daysFromNow(-3) },
      { status: "confirmed", timestamp: daysFromNow(-2, 18) },
      { status: "cancelled", timestamp: daysFromNow(-1, 9) },
    ]
  }

  const reached = STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(status) + 1)
  return reached.map((entry, index) => ({
    status: entry,
    timestamp: new Date(
      pickupAt.getTime() - (reached.length - index) * 45 * 60 * 1000,
    ),
  }))
}

const zones = [
  { name: "Tirana City", tier: 1 },
  { name: "Durrës", tier: 2 },
  { name: "Vlorë", tier: 3 },
  { name: "Berat", tier: 3 },
  { name: "Shkodër", tier: 4 },
  { name: "Sarandë", tier: 5 },
  { name: "Ksamil", tier: 5 },
  { name: "Theth / Albanian Alps", tier: 6 },
] as const

function pricingForTier(tier: number, vehicleType: VehicleType) {
  const sedan = {
    1: { baseFare: 18, perKmRate: 0.85, minFare: 28 },
    2: { baseFare: 28, perKmRate: 1.1, minFare: 38 },
    3: { baseFare: 42, perKmRate: 1.35, minFare: 55 },
    4: { baseFare: 52, perKmRate: 1.55, minFare: 68 },
    5: { baseFare: 58, perKmRate: 1.7, minFare: 78 },
    6: { baseFare: 72, perKmRate: 2.05, minFare: 95 },
  }[tier]!

  const multipliers: Record<VehicleType, number> = {
    sedan: 1,
    comfort: 1.28,
    minivan: 1.55,
    premium: 1.85,
  }

  const multiplier = multipliers[vehicleType]
  return {
    baseFare: Math.round(sedan.baseFare * multiplier),
    perKmRate: Number((sedan.perKmRate * multiplier).toFixed(2)),
    minFare: Math.round(sedan.minFare * multiplier),
  }
}

async function main() {
  await prisma.notificationLog.deleteMany()
  await prisma.flightStatusEvent.deleteMany()
  await prisma.bookingStatusEvent.deleteMany()
  await prisma.review.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.pricingRule.deleteMany()
  await prisma.zone.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.settings.deleteMany()
  await prisma.adminUser.deleteMany()

  const passwordHash = await hashPassword(ADMIN_PASSWORD)
  await prisma.adminUser.create({
    data: {
      name: "Ops Team",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    },
  })

  const createdZones = await Promise.all(
    zones.map((zone) =>
      prisma.zone.create({
        data: {
          name: zone.name,
        },
      }),
    ),
  )

  const zoneByName = Object.fromEntries(
    createdZones.map((zone) => [zone.name, zone]),
  )

  const vehicleTypes: VehicleType[] = ["sedan", "comfort", "minivan", "premium"]
  for (const zone of zones) {
    const dbZone = zoneByName[zone.name]
    for (const vehicleType of vehicleTypes) {
      const pricing = pricingForTier(zone.tier, vehicleType)
      await prisma.pricingRule.create({
        data: {
          zoneId: dbZone.id,
          vehicleType,
          baseFare: pricing.baseFare,
          perKmRate: pricing.perKmRate,
          minFare: pricing.minFare,
          currency: "EUR",
        },
      })
    }
  }

  const drivers = await Promise.all([
    prisma.driver.create({
      data: {
        name: "Ergys Hoxha",
        phone: "+355 69 201 3344",
        whatsappNumber: "+355 69 201 3344",
        vehicleMake: "Toyota",
        vehicleModel: "Corolla",
        plateNumber: "TR 452 AB",
        vehicleType: "sedan",
        languages: ["Albanian", "English", "Italian"],
        vetted: true,
        active: true,
        avgRating: 4.9,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Ana Krasniqi",
        phone: "+355 68 778 9901",
        whatsappNumber: "+355 68 778 9901",
        vehicleMake: "Skoda",
        vehicleModel: "Superb",
        plateNumber: "TR 118 CK",
        vehicleType: "comfort",
        languages: ["Albanian", "English", "German"],
        vetted: true,
        active: true,
        avgRating: 4.8,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Besnik Dervishi",
        phone: "+355 67 440 2211",
        whatsappNumber: "+355 67 440 2211",
        vehicleMake: "Volkswagen",
        vehicleModel: "Caravelle",
        plateNumber: "DR 903 LM",
        vehicleType: "minivan",
        languages: ["Albanian", "English", "Greek"],
        vetted: true,
        active: true,
        avgRating: 4.7,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Elira Gjoka",
        phone: "+355 69 550 7788",
        whatsappNumber: "+355 69 550 7788",
        vehicleMake: "Mercedes-Benz",
        vehicleModel: "V-Class",
        plateNumber: "VL 224 XY",
        vehicleType: "minivan",
        languages: ["Albanian", "English", "Italian"],
        vetted: true,
        active: true,
        avgRating: 4.8,
      },
    }),
    prisma.driver.create({
      data: {
        name: "Gentian Muça",
        phone: "+355 68 990 1144",
        whatsappNumber: "+355 68 990 1144",
        vehicleMake: "Mercedes-Benz",
        vehicleModel: "S-Class",
        plateNumber: "TR 701 PM",
        vehicleType: "premium",
        languages: ["Albanian", "English", "French"],
        vetted: true,
        active: true,
        avgRating: 5,
      },
    }),
  ])

  await prisma.settings.create({
    data: {
      id: "default",
      companyName: "Albania Transfers",
      supportPhone: "+355 4 225 1234",
      supportEmail: "ops@transfers.co",
      supportWhatsApp: "+355 69 200 1122",
      adminNotificationEmail: "ops@transfers.co",
      displayCurrencies: ["EUR", "USD", "GBP"],
      freeCancellationHours: 24,
      depositPercentage: 30,
      roundTripDiscountPercent: 0,
      infantCarrierPrice: 10,
      childSeatPrice: 12,
      boosterSeatPrice: 8,
      stripeEnabled: true,
      paypalEnabled: true,
      cashOnArrivalEnabled: false,
      airports: [{ name: "Tirana International", iataCode: "TIA" }],
      notificationChannelsEnabled: {
        confirmation: true,
        driverAssigned: true,
        flightDelay: true,
        reminder: true,
        cancellation: true,
        dateChange: true,
        completedReceipt: true,
      },
      flightDelayThresholdMinutes: 45,
    },
  })

  const freeCancellationHours = 24

  const bookingSpecs = [
    {
      referenceCode: "TRF-8F3K2A",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Hotel Plaza Tirana, Rruga 28 Nëntori, Tirana",
      pickupDateTime: hoursFromNow(3),
      flightNumber: "LH1445",
      flightStatus: "on_time" as FlightStatus,
      passengerCount: 2,
      luggageCount: 3,
      vehicleType: "sedan" as VehicleType,
      totalPrice: 42,
      depositPaid: 0,
      balanceDue: 42,
      paymentStatus: "unpaid" as PaymentStatus,
      status: "pending" as BookingStatus,
      zoneName: "Tirana City",
      customer: {
        name: "James Whitfield",
        email: "j.whitfield@example.com",
        phone: "+44 7700 900123",
      },
      driverIndex: null,
      notes: "Passenger requested a child booster seat.",
    },
    {
      referenceCode: "TRF-2M9QP1",
      direction: "dest_to_airport" as Direction,
      pickupAddress: "Hotel Adriatik, Rruga Pavaresia, Durrës",
      dropoffAddress: "Tirana International Airport (TIA), Departures",
      pickupDateTime: daysFromNow(2, 6, 30),
      flightNumber: "OS847",
      flightStatus: "delayed" as FlightStatus,
      passengerCount: 4,
      luggageCount: 5,
      vehicleType: "minivan" as VehicleType,
      totalPrice: 88,
      depositPaid: 26.4,
      balanceDue: 61.6,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "driver_assigned" as BookingStatus,
      zoneName: "Durrës",
      customer: {
        name: "Anna Kowalski",
        email: "anna.k@example.com",
        phone: "+48 512 345 678",
      },
      driverIndex: 2,
    },
    {
      referenceCode: "TRF-7HH4RC",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Berat Castle Hotel, Rruga Mihal Komnena, Berat",
      pickupDateTime: daysFromNow(-1, 14, 15),
      flightNumber: "AZ2045",
      flightStatus: "landed" as FlightStatus,
      passengerCount: 3,
      luggageCount: 4,
      vehicleType: "comfort" as VehicleType,
      totalPrice: 96,
      depositPaid: 28.8,
      balanceDue: 67.2,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "completed" as BookingStatus,
      zoneName: "Berat",
      customer: {
        name: "Diego Fernández",
        email: "d.fernandez@example.com",
        phone: "+34 600 112 233",
      },
      driverIndex: 1,
      reviewRating: 5,
      reviewComment: "Smooth ride through the mountains.",
    },
    {
      referenceCode: "TRF-5KD0ZE",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Rogner Hotel Tirana, Bulevardi Deshmoret e Kombit",
      pickupDateTime: daysFromNow(5, 11, 0),
      flightNumber: "BA2592",
      flightStatus: "scheduled" as FlightStatus,
      passengerCount: 1,
      luggageCount: 2,
      vehicleType: "premium" as VehicleType,
      totalPrice: 78,
      depositPaid: 23.4,
      balanceDue: 54.6,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "confirmed" as BookingStatus,
      zoneName: "Tirana City",
      customer: {
        name: "Priya Nair",
        email: "priya.nair@example.com",
        phone: "+91 98200 45678",
      },
      driverIndex: null,
    },
    {
      referenceCode: "TRF-9WP3LQ",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Hotel Butrinti, Rruga Teodor Keko, Sarandë",
      pickupDateTime: daysFromNow(4, 16, 45),
      flightNumber: "KL1611",
      flightStatus: "on_time" as FlightStatus,
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: "comfort" as VehicleType,
      totalPrice: 145,
      depositPaid: 43.5,
      balanceDue: 101.5,
      isBalanceCharged: true,
      paymentStatus: "fully_paid" as PaymentStatus,
      status: "completed" as BookingStatus,
      zoneName: "Sarandë",
      customer: {
        name: "Robert Chen",
        email: "r.chen@example.com",
        phone: "+1 415 555 0198",
      },
      driverIndex: 4,
      reviewRating: 5,
      reviewComment: "Excellent long-distance transfer.",
    },
    {
      referenceCode: "TRF-1AB6YT",
      direction: "dest_to_airport" as Direction,
      pickupAddress: "Liro Hotel, Rruga e Butrintit, Ksamil",
      dropoffAddress: "Tirana International Airport (TIA), Departures",
      pickupDateTime: daysFromNow(6, 8, 0),
      flightNumber: "IB3251",
      flightStatus: "scheduled" as FlightStatus,
      passengerCount: 2,
      luggageCount: 2,
      vehicleType: "sedan" as VehicleType,
      totalPrice: 118,
      depositPaid: 35.4,
      balanceDue: 82.6,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "pending" as BookingStatus,
      zoneName: "Ksamil",
      customer: {
        name: "Marie Dubois",
        email: "m.dubois@example.com",
        phone: "+33 6 12 34 56 78",
      },
      driverIndex: null,
    },
    {
      referenceCode: "TRF-4RT8NM",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Hotel Colosseo, Rruga 13 Dhjetori, Shkodër",
      pickupDateTime: daysFromNow(1, 19, 30),
      flightNumber: "UA0900",
      flightStatus: "on_time" as FlightStatus,
      passengerCount: 5,
      luggageCount: 6,
      vehicleType: "minivan" as VehicleType,
      totalPrice: 112,
      depositPaid: 33.6,
      balanceDue: 78.4,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "confirmed" as BookingStatus,
      zoneName: "Shkodër",
      customer: {
        name: "Tomasz Nowak",
        email: "t.nowak@example.com",
        phone: "+48 601 234 567",
      },
      driverIndex: null,
    },
    {
      referenceCode: "TRF-6QC2WD",
      direction: "dest_to_airport" as Direction,
      pickupAddress: "Guesthouse Theth, Theth Village, Shkodër County",
      dropoffAddress: "Tirana International Airport (TIA), Departures",
      pickupDateTime: daysFromNow(-2, 7, 0),
      flightNumber: "EK0206",
      flightStatus: "cancelled" as FlightStatus,
      passengerCount: 2,
      luggageCount: 3,
      vehicleType: "premium" as VehicleType,
      totalPrice: 165,
      depositPaid: 49.5,
      balanceDue: 115.5,
      paymentStatus: "refunded" as PaymentStatus,
      status: "cancelled" as BookingStatus,
      zoneName: "Theth / Albanian Alps",
      customer: {
        name: "Olivia Brown",
        email: "o.brown@example.com",
        phone: "+61 400 123 456",
      },
      driverIndex: null,
    },
    {
      referenceCode: "TRF-3ZX5PL",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Hotel Vlora International, Rruga Justin Godard, Vlorë",
      pickupDateTime: daysFromNow(3, 13, 20),
      flightNumber: "QR0127",
      flightStatus: "on_time" as FlightStatus,
      passengerCount: 2,
      luggageCount: 3,
      vehicleType: "sedan" as VehicleType,
      totalPrice: 74,
      depositPaid: 0,
      balanceDue: 51.8,
      paymentStatus: "failed" as PaymentStatus,
      status: "pending" as BookingStatus,
      zoneName: "Vlorë",
      customer: {
        name: "Hiroshi Tanaka",
        email: "h.tanaka@example.com",
        phone: "+81 90 1234 5678",
      },
      driverIndex: null,
      notes: "Card payment failed — customer asked to retry.",
    },
    {
      referenceCode: "TRF-0PL8VN",
      direction: "airport_to_dest" as Direction,
      pickupAddress: "Tirana International Airport (TIA), Arrivals Hall",
      dropoffAddress: "Maritimo Hotel, Rruga Taulantia, Durrës",
      pickupDateTime: hoursFromNow(1.5),
      flightNumber: "W64521",
      flightStatus: "landed" as FlightStatus,
      passengerCount: 3,
      luggageCount: 4,
      vehicleType: "comfort" as VehicleType,
      totalPrice: 58,
      depositPaid: 17.4,
      balanceDue: 40.6,
      paymentStatus: "deposit_paid" as PaymentStatus,
      status: "driver_assigned" as BookingStatus,
      zoneName: "Durrës",
      customer: {
        name: "Elena Marku",
        email: "elena.marku@example.com",
        phone: "+355 69 812 3344",
      },
      driverIndex: 0,
    },
  ]

  for (const [bookingIndex, spec] of bookingSpecs.entries()) {
    const customer = await prisma.customer.create({ data: spec.customer })
    const zone = zoneByName[spec.zoneName]
    const driver =
      spec.driverIndex !== null ? drivers[spec.driverIndex] : null
    const freeCancellationUntil = new Date(
      spec.pickupDateTime.getTime() - freeCancellationHours * 60 * 60 * 1000,
    )

    const booking = await prisma.booking.create({
      data: {
        referenceCode: spec.referenceCode,
        // Deterministic unique PIN per seed booking (hash alone can collide).
        pickupPin: String(
          (Math.abs(
            [...spec.referenceCode].reduce(
              (acc, ch) => acc + ch.charCodeAt(0),
              0,
            ) * 7919,
          ) +
            bookingIndex) %
            1_000_000,
        ).padStart(6, "0"),
        direction: spec.direction,
        pickupAddress: spec.pickupAddress,
        dropoffAddress: spec.dropoffAddress,
        pickupDateTime: spec.pickupDateTime,
        flightNumber: spec.flightNumber,
        flightStatus: spec.flightStatus,
        passengerCount: spec.passengerCount,
        luggageCount: spec.luggageCount,
        vehicleType: spec.vehicleType,
        totalPrice: spec.totalPrice,
        depositAmount: spec.depositPaid > 0 ? spec.depositPaid : Number((spec.totalPrice * 0.3).toFixed(2)),
        depositPaid: spec.depositPaid,
        balanceDue: spec.balanceDue,
        isBalanceCharged: spec.isBalanceCharged ?? false,
        balanceChargedAt: spec.isBalanceCharged ? daysFromNow(-1, 18, 0) : undefined,
        balanceChargedBy: spec.isBalanceCharged ? "admin" : undefined,
        paymentStatus: spec.paymentStatus,
        status: spec.status,
        currency: "EUR",
        freeCancellationUntil,
        notes: spec.notes,
        customerId: customer.id,
        driverId: driver?.id,
        zoneId: zone.id,
        statusEvents: {
          create: buildStatusEvents(spec.status, spec.pickupDateTime),
        },
        flightStatusEvents: {
          create: [
            {
              flightNumber: spec.flightNumber,
              status: spec.flightStatus,
              scheduledAt: spec.pickupDateTime,
              observedAt: new Date(),
              delayMinutes: spec.flightStatus === "delayed" ? 55 : 0,
              source: "flightapi",
            },
          ],
        },
      },
    })

    if (spec.depositPaid > 0) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          type: "deposit",
          amount: spec.depositPaid,
          currency: "EUR",
          status:
            spec.paymentStatus === "failed"
              ? "failed"
              : spec.paymentStatus === "refunded"
                ? "refunded"
                : "deposit_paid",
          provider: "stripe",
          externalId: `pi_${spec.referenceCode.toLowerCase()}`,
          paidAt:
            spec.paymentStatus === "failed"
              ? undefined
              : daysFromNow(-1, 12, 0),
        },
      })
    }

    if (spec.isBalanceCharged) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          type: "balance",
          amount: spec.balanceDue,
          currency: "EUR",
          status: "paid",
          provider: "stripe",
          externalId: `pi_${spec.referenceCode.toLowerCase()}_bal`,
          paidAt: daysFromNow(-1, 18, 0),
        },
      })
    }

    if (driver && "reviewRating" in spec && spec.reviewRating) {
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          driverId: driver.id,
          driverRating: spec.reviewRating,
          driverComment: spec.reviewComment,
          platformRating: spec.reviewRating,
          platformComment: spec.reviewComment,
          status: "approved",
          moderatedAt: daysFromNow(-1, 12, 0),
        },
      })
    }

    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        customerId: customer.id,
        channel: NotificationChannel.email,
        type: NotificationType.confirmation,
        status: NotificationStatus.sent,
        recipient: customer.email,
        subject: `Booking confirmed — ${spec.referenceCode}`,
        body: `Your transfer from ${spec.pickupAddress} is confirmed.`,
        sentAt: daysFromNow(-1, 10, 0),
      },
    })

    if (driver) {
      await prisma.notificationLog.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          channel: NotificationChannel.whatsapp,
          type: NotificationType.driver_assigned,
          status: NotificationStatus.sent,
          recipient: customer.phone,
          body: `Your driver ${driver.name} has been assigned.`,
          sentAt: daysFromNow(-1, 11, 0),
        },
      })
    }
  }

  console.log("Seed complete:")
  console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`  Zones: ${createdZones.length}`)
  console.log(`  Pricing rules: ${createdZones.length * vehicleTypes.length}`)
  console.log(`  Drivers: ${drivers.length}`)
  console.log(`  Bookings: ${bookingSpecs.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
