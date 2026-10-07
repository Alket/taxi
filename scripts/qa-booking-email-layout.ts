/**
 * QA: booking confirmation email HTML layout (customer + admin).
 *
 * Checks design shell uses real logo/brand, dynamic reservation fields,
 * and never includes mock "Your Brand" placeholders.
 *
 * Run: npm run test:booking-email-layout
 */
import { renderBookingTripEmail } from "../lib/emails/booking-layout"
import { emailLogoUrl } from "../lib/emails/templates"
import type { Settings } from "../lib/types"

type Result = { status: "PASS" | "FAIL"; case: string; detail?: string }
const results: Result[] = []

function pass(c: string, d = "") {
  results.push({ status: "PASS", case: c, detail: d })
  console.log("PASS:", c, d || "")
}
function fail(c: string, d = "") {
  results.push({ status: "FAIL", case: c, detail: d })
  console.log("FAIL:", c, "—", d)
}
function check(c: string, ok: boolean, detail = "") {
  if (ok) pass(c, detail)
  else fail(c, detail)
}

const settings = {
  companyName: "Landed Albania",
  supportEmail: "ops@transfers.co",
  supportPhone: "+355 00 000 000",
} as Settings

function sampleLeg(overrides: Record<string, unknown> = {}) {
  return {
    referenceCode: "TRF-FE3F1A",
    pickupPin: "312596",
    pickupAddress: "Tirana International (TIA)",
    dropoffAddress: "Sarandë",
    pickupDateTime: new Date("2026-10-09T01:00:00.000Z"),
    flightNumber: "W45154",
    vehicleType: "sedan",
    passengerCount: 2,
    luggageCount: 0,
    currency: "EUR",
    totalPrice: 170,
    balanceDue: 170,
    bookedForOther: true,
    passengerName: "Mary Yetunde Ogunbanwo",
    passengerEmail: "passenger@example.com",
    passengerPhone: "+34632680911",
    passengerNoEmail: false,
    bookerRelation: "travel_agent",
    customer: {
      name: "Oluwatobi Olaniyan",
      email: "booker@example.com",
      phone: "+34632680911",
    },
    ...overrides,
  }
}

function main() {
  console.log("\nQA booking email layout\n")

  const logo = emailLogoUrl()
  const singleAdmin = renderBookingTripEmail({
    audience: "admin",
    bookingId: "booking_single_qa",
    legs: [sampleLeg()],
    settings,
  })
  const singleCustomer = renderBookingTripEmail({
    audience: "customer",
    bookingId: "booking_single_qa",
    legs: [sampleLeg()],
    settings,
  })
  const roundAdmin = renderBookingTripEmail({
    audience: "admin",
    bookingId: "booking_round_qa",
    legs: [
      sampleLeg(),
      sampleLeg({
        referenceCode: "TRF-86042B",
        pickupPin: "684547",
        pickupAddress: "Sarandë",
        dropoffAddress: "Tirana International (TIA)",
        pickupDateTime: new Date("2026-10-12T08:00:00.000Z"),
        balanceDue: 170,
        totalPrice: 170,
      }),
    ],
    settings,
  })

  check("A1 logo URL present", singleAdmin.includes(logo), logo)
  check("A2 logo img tag", /<img[^>]+src="[^"]*logo-email\.png"/i.test(singleAdmin))
  check("A3 no Your Brand", !singleAdmin.includes("Your Brand"))
  check(
    "A4 Mulish webfont",
    singleAdmin.includes("Mulish") &&
      singleAdmin.includes("fonts.googleapis.com/css2?family=Mulish"),
  )
  check("A5 accent color", singleAdmin.includes("#1D9E75") || singleAdmin.includes("#1d9e75"))
  check(
    "A5b fluid wrap (Gmail mobile)",
    singleAdmin.includes('class="wrap"') &&
      singleAdmin.includes("width:100%") &&
      singleAdmin.includes("max-width:600px"),
  )
  check(
    "A5c dark mode (Gmail light only + Apple dark)",
    singleAdmin.includes('content="light only"') &&
      singleAdmin.includes("color-scheme: light dark") &&
      singleAdmin.includes("prefers-color-scheme: dark"),
  )
  check(
    "A5d mockup padding + leg card style",
    singleAdmin.includes("padding:40px 40px 8px") &&
      singleAdmin.includes("padding:24px 40px 0") &&
      singleAdmin.includes("padding:30px 40px 0") &&
      singleAdmin.includes("padding:34px 40px 40px") &&
      singleAdmin.includes("#eef6f2") &&
      singleAdmin.includes("border:2px solid #b9d2c7") &&
      singleAdmin.includes("#e1ebe6"),
  )
  check(
    "A5e people not wrapped in card",
    singleAdmin.includes(">People<") &&
      !singleAdmin.includes("People</div>\n        <table role=\"presentation\" class=\"dm-card\""),
  )
  check("A6 single admin title", singleAdmin.includes("New single trip received"))
  check("A7 balance due amount", singleAdmin.includes("€170.00") || singleAdmin.includes("€170"))
  check("A8 reference code", singleAdmin.includes("TRF-FE3F1A"))
  check("A9 pickup address", singleAdmin.includes("Tirana International (TIA)"))
  check("A10 drop-off", singleAdmin.includes("Sarandë"))
  check("A11 flight", singleAdmin.includes("W45154"))
  check("A12 pickup PIN", singleAdmin.includes("312596"))
  check("A13 vehicle chip", singleAdmin.includes("Sedan") || singleAdmin.includes("sedan"))
  check("A14 passengers chip", singleAdmin.includes("2 passenger"))
  check("A15 booker name", singleAdmin.includes("Oluwatobi Olaniyan"))
  check("A16 passenger name", singleAdmin.includes("Mary Yetunde Ogunbanwo"))
  check("A17 travel agent chip", singleAdmin.includes("Travel agent"))
  check("A18 admin CTA", singleAdmin.includes("Open in admin"))
  check(
    "A19 admin booking link",
    singleAdmin.includes("/admin/bookings?bookingId=booking_single_qa"),
  )
  check("A20 company in footer", singleAdmin.includes("Landed Albania"))

  check("C1 customer title", singleCustomer.includes("Your transfer is booked"))
  check(
    "C2 no confirmed badge",
    !singleCustomer.includes("Confirmed") &&
      !singleAdmin.includes("New booking confirmed"),
  )
  check(
    "C2b leg meta stays one row (no col stack)",
    singleAdmin.includes("table-layout:fixed") &&
      !singleAdmin.includes('class="col '),
  )
  check("C3 manage CTA", singleCustomer.includes("Manage booking"))
  check("C4 manage link", singleCustomer.includes("/my-booking"))
  check("C5 no assign-driver copy", !singleCustomer.includes("assign a driver"))
  check("C6 no Your Brand", !singleCustomer.includes("Your Brand"))

  check("R1 round title", roundAdmin.includes("New round trip received"))
  check("R2 both refs", roundAdmin.includes("TRF-FE3F1A") && roundAdmin.includes("TRF-86042B"))
  check("R3 outbound label", roundAdmin.includes("Outbound"))
  check("R4 return label", roundAdmin.includes("Return"))
  check(
    "R5 combined balance",
    roundAdmin.includes("€340.00") || roundAdmin.includes("€340"),
  )
  check("R6 legs meta", roundAdmin.includes("2 legs"))
  check("R7 no Your Brand", !roundAdmin.includes("Your Brand"))

  // XSS: names/addresses escaped
  const xss = renderBookingTripEmail({
    audience: "admin",
    bookingId: "xss",
    legs: [
      sampleLeg({
        pickupAddress: `<script>alert(1)</script>`,
        customer: {
          name: `Eve <img src=x onerror=alert(1)>`,
          email: "eve@example.com",
          phone: "+355600000000",
        },
        bookedForOther: false,
      }),
    ],
    settings,
  })
  check("X1 script escaped", xss.includes("&lt;script&gt;") && !xss.includes("<script>alert"))
  check(
    "X2 img markup escaped",
    xss.includes("&lt;img") && !/<img[^>]*onerror=/i.test(xss),
  )

  const failed = results.filter((r) => r.status === "FAIL").length
  const passed = results.filter((r) => r.status === "PASS").length
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
