import { prisma } from "@/lib/db"
import { DESTINATIONS, type Destination, slugifyDestinationId } from "@/lib/destinations"
import { BLOG_POSTS } from "@/lib/blog/posts"
import {
  blogPostToSections,
  emptyBlogSections,
  pageContentToBlogPost,
  slugifyBlogId,
} from "@/lib/blog/cms"
import {
  DEFAULT_LOCALE,
  type Locale,
  isLocale,
  localePath,
  localizedAlternates,
} from "@/lib/i18n/locales"
import {
  resolveMediaAlt,
} from "@/lib/media-shared"
import { mediaMetaByUrls } from "@/lib/media"
import {
  type HomeMarketingCopy,
  type PageContentRecord,
  type PageSection,
  type PageSectionType,
  blogIdFromSlug,
  ensureMissingDefaultSections,
  homeCopyFromSections,
  isBlogSlug,
  isCorePageSlug,
  mergeLocalizedSections,
  parseSections,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content-shared"
import {
  type DestinationDocument,
  blankDestinationDocumentForLocale,
  destinationDocumentFromSeed,
  destinationHeroImage,
  destinationMetaToCardFields,
  destinationStorageIsFeatured,
  destinationStorageIsHidden,
  getDestinationHero,
  isDestinationDocumentHidden,
  isDestinationDocumentV2,
  mergeDestinationDocuments,
  parseDestinationDocument,
  serializeDestinationDocument,
  withDestinationFeatured,
  withDestinationHidden,
} from "@/lib/destination-document"

export {
  PAGE_SECTION_TYPES,
  CORE_PAGE_SLUGS,
  isCorePageSlug,
  isBlogSlug,
  pageHeroImageKey,
  blogIdFromSlug,
  type PageSectionType,
  type PageSection,
  type PageContentRecord,
  type HomeMarketingCopy,
  type BlogArchiveCopy,
  type DestinationAttraction,
  type CorePageSlug,
  parseSections,
  sectionValue,
  sectionHeading,
  faqSections,
  attractionSections,
  attractionsFromSections,
  homeCopyFromSections,
  blogArchiveCopyFromSections,
  mergeLocalizedSections,
  ensureMissingDefaultSections,
} from "@/lib/page-content-shared"

export type PageDefinition = {
  slug: string
  label: string
  path: string
  defaults: Omit<
    PageContentRecord,
    "slug" | "label" | "fromDatabase" | "updatedAt"
  >
}

function newId() {
  return globalThis.crypto.randomUUID()
}

function section(
  type: PageSectionType,
  key: string,
  fields: Partial<Omit<PageSection, "id" | "type" | "key">> = {},
): PageSection {
  return { id: newId(), type, key, ...fields }
}

/** Used when a page has no CMS-set `ogImage` — keeps social share cards from being blank. */
export const DEFAULT_OG_IMAGE =
  "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg"

const HOME_DEFAULTS: PageDefinition["defaults"] = {
  title: "Tirana Airport Transfer · Albania Transfers",
  description:
    "Book a reliable Tirana Airport transfer and rides across Albania. Fixed prices, vetted drivers, clear cancellation terms.",
  ogImage: DEFAULT_OG_IMAGE,
  sections: [
    section("heading", "hero.heading", {
      heading: "Tirana Airport Transfer,\nMade Simple.",
      level: 1,
    }),
    section("text", "hero.text", {
      body: "Personalised airport transfers designed for travel across Albania.",
    }),
    section("image", "hero.image", {
      src: "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg",
    }),
    section("text", "hero.showTrustpilot", {
      body: "true",
    }),
    section("text", "uberAlt.eyebrow", {
      body: "No Uber in Albania?",
    }),
    section("heading", "uberAlt.heading", {
      heading: "The Seamless Uber Alternative at Tirana Airport",
      level: 2,
    }),
    section("text", "uberAlt.highlight", {
      body: "Uber Alternative",
    }),
    section("text", "uberAlt.text", {
      body: "Looking for Uber, Bolt, or Lyft after landing at Tirana International Airport (TIA)? Global ride-hailing apps do not operate in Albania. Instead of negotiating with unmetered airport street taxis, exchanging currency at high terminal rates, or waiting in line, Landed Albania provides the modern booking experience you expect.",
    }),
    section("heading", "uberAlt.feature1.heading", {
      heading: "Fixed Pricing",
      level: 3,
    }),
    section("text", "uberAlt.feature1.text", {
      body: "Zero surge fees or surprises",
    }),
    section("heading", "uberAlt.feature2.heading", {
      heading: "Flight Tracking",
      level: 3,
    }),
    section("text", "uberAlt.feature2.text", {
      body: "Automated driver pickup adjustments",
    }),
    section("text", "uberAlt.cta", {
      body: "Calculate Your Fixed Fare",
    }),
    section("image", "uberAlt.image", {
      src: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1200&auto=format&fit=crop",
      alt: "Landed Albania premium airport transfer",
    }),
    section("heading", "uberAlt.floatingBadge.heading", {
      heading: "Under 2 Minutes",
      level: 3,
    }),
    section("text", "uberAlt.floatingBadge.text", {
      body: "Quick & Easy Online Booking",
    }),
    section("heading", "whyBook.heading", {
      heading: "Why book with us?",
      level: 2,
    }),
    section("heading", "whyBook.item1.heading", {
      heading: "24/7 Help Center",
      level: 3,
      icon: "headset",
    }),
    section("text", "whyBook.item1.text", {
      body: "No matter the time zone, we're always here to assist you and answer your questions.",
    }),
    section("heading", "whyBook.item2.heading", {
      heading: "Best Price Guarantee",
      level: 3,
      icon: "wallet",
    }),
    section("text", "whyBook.item2.text", {
      body: "Find a lower price? We'll match it or refund the difference, hassle-free.",
    }),
    section("heading", "whyBook.item3.heading", {
      heading: "Quality & Reliability",
      level: 3,
      icon: "shield",
    }),
    section("text", "whyBook.item3.text", {
      body: "Book with confidence knowing our services meet the highest standards of safety and trust.",
    }),
    section("heading", "destinations.heading", {
      heading: "Featured Destinations",
      level: 2,
    }),
    section("text", "destinations.text", {
      body: "Discover our most popular hand-picked locations for your next unforgettable journey.",
    }),
    section("text", "compare.eyebrow", {
      body: "Why Landed vs. Competitors",
    }),
    section("heading", "compare.heading", {
      heading: "The Clear Choice for Tirana Airport Transfers",
      level: 2,
    }),
    section("text", "compare.subtitle", {
      body: "Compare Landed Albania directly against local airport street taxis and global booking brokers.",
    }),
    section("heading", "compare.taxi.title", {
      heading: "Airport Terminal Taxis",
      level: 3,
    }),
    section("text", "compare.taxi.items", {
      body: "Pricing: Metered or Negotiated Cash\nPayment: Cash Only (Euros/LEK)\nDrivers: Hit-or-Miss English\nTracking: None (Taxi leaves if delayed)\nMeet & Greet: Wait outside in crowded rank\nFocus: General Local Rides",
    }),
    section("heading", "compare.landed.title", {
      heading: "Landed Albania",
      level: 3,
    }),
    section("text", "compare.landed.badge", {
      body: "Best Experience",
    }),
    section("text", "compare.landed.items", {
      body: "Pricing: Fixed Flat Rate (Upfront)\nPayment: Yes (Deposit + Online Balance)\nDrivers: 100% Vetted English Drivers\nTracking: Included Free (Delays Covered)\nMeet & Greet: Driver holds name sign\nFocus: 100% Tirana Airport Specialist",
    }),
    section("heading", "compare.broker.title", {
      heading: "Global Aggregators",
      level: 3,
    }),
    section("text", "compare.broker.subtitle", {
      body: "(e.g., GetTransfer)",
    }),
    section("text", "compare.broker.items", {
      body: "Pricing: Variable Bidding / Hidden Fees\nPayment: Card (High Commission)\nDrivers: Unverified Third-Party Fleet\nTracking: Extra Charges for Updates\nMeet & Greet: Dependent on driver choice\nFocus: Non-local Broker",
    }),
    section("heading", "testimonials.heading", {
      heading: "Trusted by travellers across Albania",
      level: 2,
    }),
    section("text", "testimonials.eyebrow", {
      body: "Traveller stories",
    }),
    section("text", "peace.eyebrow", {
      body: "Absolute Peace of Mind",
    }),
    section("heading", "peace.heading", {
      heading: "Why Book with Albania Transfers",
      level: 2,
    }),
    section("heading", "peace.item1", {
      heading: "Pay Cash on Arrival",
      level: 3,
      icon: "dollar",
    }),
    section("text", "peace.item1.text", {
      body: "Zero upfront deposit. Pay in Euros (€) or Lek (ALL).",
    }),
    section("heading", "peace.item2", {
      heading: "100% Vetted Drivers",
      level: 3,
      icon: "shield",
    }),
    section("text", "peace.item2.text", {
      body: "Licensed, background-checked professionals.",
    }),
    section("heading", "peace.item3", {
      heading: "Fixed Rates",
      level: 3,
      icon: "wallet",
    }),
    section("text", "peace.item3.text", {
      body: "No meters, surge, or cash exchange markup.",
    }),
    section("heading", "peace.item4", {
      heading: "Live Flight Tracking",
      level: 3,
      icon: "plane",
    }),
    section("text", "peace.item4.text", {
      body: "Free pickup updates for delayed or early flights.",
    }),
    section("heading", "peace.item5", {
      heading: "Terminal Meet-&-Greet",
      level: 3,
      icon: "user",
    }),
    section("text", "peace.item5.text", {
      body: "Driver holds name sign inside arrivals hall.",
    }),
    section("heading", "peace.item6", {
      heading: "Know Your Driver",
      level: 3,
      icon: "map",
    }),
    section("text", "peace.item6.text", {
      body: "See car model, name, & plate number.",
    }),
    section("heading", "safety.heading", {
      heading: "Safety is our #1 priority",
      level: 2,
    }),
    section("heading", "safety.item1.heading", {
      heading: "1000s of experienced drivers",
      level: 3,
    }),
    section("text", "safety.item1.text", {
      body: "With thousands of drivers in one app, you can book a transfer wherever you are, even in times of high demand.",
    }),
    section("image", "safety.item1.image", {
      src: "/marketing/safety-drivers.png",
      alt: "Using the booking app to find nearby drivers",
    }),
    section("heading", "safety.item2.heading", {
      heading: "Know your driver",
      level: 3,
    }),
    section("text", "safety.item2.text", {
      body: "When you hop on an Albania Transfers ride, you'll know your driver's details, rating, and driving experience to make sure you're in safe hands.",
    }),
    section("image", "safety.item2.image", {
      src: "/marketing/safety-know-driver.png",
      alt: "Friendly professional driver ready for pickup",
    }),
    section("faq_item", "faq.1", {
      question: "How far in advance should I book?",
      answer:
        "We recommend booking as soon as your flight is confirmed. Same-day transfers are often available subject to driver capacity.",
    }),
    section("faq_item", "faq.2", {
      question: "What is included in the price?",
      answer:
        "Your fare is fixed and includes meet-and-greet, flight tracking, and door-to-door transfer. Tolls and child seats may be added where selected.",
    }),
  ],
}

const CANCELLATION_DEFAULTS: PageDefinition["defaults"] = {
  title: "Cancellation Policy",
  description:
    "Customer cancellations forfeit the deposit. No free-cancellation window. Full refund only if the driver fails to show or the service is not delivered.",
  ogImage: "",
  sections: [
    section("text", "eyebrow", { body: "Booking terms" }),
    section("heading", "title", {
      heading: "Cancellation Policy",
      level: 1,
    }),
    section("text", "intro", {
      body: "Clear rules so you know exactly what happens if a booking is cancelled.",
    }),
    section("heading", "customer.heading", {
      heading: "Customer cancellations",
      level: 2,
    }),
    section("text", "customer.text", {
      body: "There is no free-cancellation window. If you cancel a booking for any reason:\n• The deposit paid (typically 30% of the trip total) is forfeited — no refund is issued.\n• The remaining balance (typically 70%) is never charged.\n• Cancellation cannot be undone once confirmed.",
    }),
    section("heading", "refund.heading", {
      heading: "When a full refund applies",
      level: 2,
    }),
    section("text", "refund.text", {
      body: "If the driver fails to show or the service is not delivered, that is not treated as a customer-initiated cancellation. In those cases you are entitled to a full refund of amounts paid. Contact support with your booking reference and we will resolve it.",
    }),
    section("heading", "how.heading", {
      heading: "How to cancel",
      level: 2,
    }),
    section("text", "how.text", {
      body: "Use My booking with your reference code and email, or contact support. Online cancellation is available until the driver has arrived.",
    }),
    section("faq_item", "faq.1", {
      question: "Do I get my deposit back if I cancel?",
      answer:
        "No. Customer-initiated cancellations forfeit the deposit. The remaining balance is never charged.",
    }),
  ],
}

const PRIVACY_DEFAULTS: PageDefinition["defaults"] = {
  title: "Privacy Policy",
  description:
    "How we collect, use, and protect personal information when you book airport transfers in Albania.",
  ogImage: "",
  sections: [
    section("heading", "title", { heading: "Privacy Policy", level: 1 }),
    section("text", "intro", {
      body: "How we collect, use, and protect your personal information when you use our booking site and transfer services.",
    }),
    section("heading", "collect.heading", {
      heading: "What we collect",
      level: 2,
    }),
    section("text", "collect.text", {
      body: "We collect information you provide when booking or managing a transfer, including:\n• Name, email address, and phone number\n• Pickup and drop-off details, flight number, and travel date/time\n• Passenger and luggage counts, and optional preferences (e.g. child seats)\n• Payment-related details processed by our payment providers (we do not store full card numbers)",
    }),
    section("heading", "use.heading", {
      heading: "How we use your data",
      level: 2,
    }),
    section("text", "use.text", {
      body: "We use your information to:\n• Confirm and deliver your transfer\n• Contact you about your booking (including delays or driver updates)\n• Process payments and prevent fraud\n• Improve our website and customer support\n• Meet legal and accounting obligations",
    }),
    section("heading", "sharing.heading", {
      heading: "Sharing",
      level: 2,
    }),
    section("text", "sharing.text", {
      body: "We share booking details with assigned drivers and operations staff only as needed to deliver your transfer. Payment processors handle card and wallet payments on our behalf. We do not sell your personal data.",
    }),
    section("heading", "rights.heading", {
      heading: "Your rights",
      level: 2,
    }),
    section("text", "rights.text", {
      body: "Depending on applicable law, you may request access, correction, or deletion of your personal data, or object to certain processing. Contact us with your booking reference and we will respond as soon as reasonably possible.",
    }),
    section("heading", "contact.heading", {
      heading: "Contact",
      level: 2,
    }),
    section("text", "contact.text", {
      body: "For privacy questions, use the contact details in the website footer or email our support team. Please include your booking reference when relevant.",
    }),
  ],
}

const TERMS_DEFAULTS: PageDefinition["defaults"] = {
  title: "Terms & Conditions",
  description:
    "Terms that apply when you book and travel with our airport transfer service in Albania.",
  ogImage: "",
  sections: [
    section("heading", "title", { heading: "Terms & Conditions", level: 1 }),
    section("text", "intro", {
      body: "These terms apply when you book and travel with our private transfer service. By completing a booking you agree to them.",
    }),
    section("heading", "service.heading", {
      heading: "Our service",
      level: 2,
    }),
    section("text", "service.text", {
      body: "We provide private airport and city transfers in Albania. The quoted fare is for the vehicle and route shown at booking, including meet-and-greet and flight monitoring where offered. Waiting time, route changes, or extras may affect the final amount if agreed separately.",
    }),
    section("heading", "bookings.heading", {
      heading: "Bookings",
      level: 2,
    }),
    section("text", "bookings.text", {
      body: "A booking is confirmed when you receive a reference code and confirmation email. You are responsible for accurate pickup details, flight numbers, and contact information. You can look up and manage eligible bookings via My booking using your reference and email.",
    }),
    section("heading", "payments.heading", {
      heading: "Payments",
      level: 2,
    }),
    section("text", "payments.text", {
      body: "Prices are shown before checkout. A deposit may be required to confirm the booking; any remaining balance is due as stated at checkout (often to the driver). Refunds and cancellations follow our Cancellation Policy.",
    }),
    section("heading", "liability.heading", {
      heading: "Liability",
      level: 2,
    }),
    section("text", "liability.text", {
      body: "We aim to deliver reliable, on-time transfers. We are not responsible for delays caused by factors outside our control (including traffic, weather, or airline changes), beyond what is required by law. Please keep valuables with you; report issues promptly with your booking reference.",
    }),
    section("heading", "contact.heading", {
      heading: "Contact",
      level: 2,
    }),
    section("text", "contact.text", {
      body: "Questions about these terms can be sent to the support contacts listed on this website.",
    }),
  ],
}

const COOKIES_DEFAULTS: PageDefinition["defaults"] = {
  title: "Cookie Policy",
  description:
    "How we use cookies and similar technologies on our transfer booking website.",
  ogImage: "",
  sections: [
    section("heading", "title", { heading: "Cookie Policy", level: 1 }),
    section("text", "intro", {
      body: "This page explains how we use cookies and similar technologies when you visit our site.",
    }),
    section("heading", "what.heading", {
      heading: "What are cookies?",
      level: 2,
    }),
    section("text", "what.text", {
      body: "Cookies are small text files stored on your device. They help the site remember preferences, keep sessions working, and understand how pages are used.",
    }),
    section("heading", "how.heading", {
      heading: "How we use cookies",
      level: 2,
    }),
    section("text", "how.text", {
      body: "We use cookies to:\n• Keep essential booking and locale settings working\n• Remember language preference\n• Measure basic site performance and improve the booking flow\n• Support secure login for staff areas where applicable",
    }),
    section("heading", "manage.heading", {
      heading: "Managing cookies",
      level: 2,
    }),
    section("text", "manage.text", {
      body: "You can block or delete cookies in your browser settings. Essential cookies may be required for booking and language features to work correctly. Disabling cookies can limit site functionality.",
    }),
    section("heading", "third.heading", {
      heading: "Third-party cookies",
      level: 2,
    }),
    section("text", "third.text", {
      body: "Payment providers and similar partners may set their own cookies when you complete checkout. Those cookies are governed by the partner’s policies. We only enable what is needed to process your booking securely.",
    }),
  ],
}

const BLOG_ARCHIVE_DEFAULTS: PageDefinition["defaults"] = {
  title: "Albania Airport Transport Guides | Landed",
  description:
    "TIA transit tips, destination routes, and fixed-price airport transfer guides for Albania travellers.",
  ogImage: "",
  sections: [
    section("text", "hero.eyebrow", { body: "Landed Guides" }),
    section("heading", "hero.heading", {
      heading: "Albania Airport Transport & Travel Guides",
      level: 1,
    }),
    section("text", "hero.text", {
      body: "Practical guides for Tirana International Airport (TIA) transit, airport logistics, and fixed-price route tips across Albania—written for travellers who want clarity before they land.",
    }),
    section("text", "cta.eyebrow", { body: "Fixed fare · €0 deposit" }),
    section("heading", "cta.heading", {
      heading: "Calculate your Tirana Airport transfer",
      level: 2,
    }),
    section("text", "cta.text", {
      body: "Get a fixed price from TIA before you fly. Meet your driver on arrival and pay cash—no deposit required to reserve.",
    }),
    section("text", "cta.button", { body: "Get my fixed fare" }),
  ],
}

/** Route-specific copy (distance/time from Tirana Airport + why-book blurb) for built-in destinations. */
const DESTINATION_ROUTE_INFO: Record<
  string,
  { distance: string; duration: string; whyBook: string }
> = {
  tirana: {
    distance: "17 km from Tirana International Airport (TIA)",
    duration: "≈ 20–25 minutes by car",
    whyBook:
      "The shortest private driver Tirana Airport run on our network—ideal for city breaks or a late night TIA airport taxi alternative with a fixed taxi rate TIA quote and cash on arrival transfer.",
  },
  durres: {
    distance: "35 km from Tirana International Airport (TIA)",
    duration: "≈ 35–40 minutes by car",
    whyBook:
      "A straight highway run to Durrës (Durres)—popular with cruise passengers who want a fixed-price airport transfer straight from the plane to the sand.",
  },
  vlore: {
    distance: "≈ 145 km from Tirana International Airport (TIA)",
    duration: "≈ 2 hours by car",
    whyBook:
      "Your gateway to Vlorë (Vlora) and the Riviera toward Himarë (Himara) and Dhërmi (Dhermi). Skip bus connections—go direct with a cash on arrival transfer and fixed taxi rate from TIA.",
  },
  sarande: {
    distance: "≈ 230 km from Tirana International Airport (TIA)",
    duration: "≈ 3.5–4 hours by car",
    whyBook:
      "One of our most-booked routes to Sarandë (Saranda). A private driver Tirana Airport booking with a locked fare beats multi-leg buses—especially for late-night landings and Corfu connections.",
  },
  ksamil: {
    distance: "≈ 240 km from Tirana International Airport (TIA)",
    duration: "≈ 4 hours by car",
    whyBook:
      "Direct door-to-door to Ksamil (Ksamili)—no changing vehicles in Saranda. Fixed taxi rate TIA pricing, flight tracking, and meet & greet included.",
  },
  berat: {
    distance: "≈ 120 km from Tirana International Airport (TIA)",
    duration: "≈ 2 hours by car",
    whyBook:
      "A comfortable scenic ride to Berat (Berati)—start sightseeing the same day you land with a fixed-price cash on arrival transfer from TIA.",
  },
  shkoder: {
    distance: "≈ 100 km from Tirana International Airport (TIA)",
    duration: "≈ 1.5 hours by car",
    whyBook:
      "The fastest way north to Shkodër (Shkodra)—ideal if you continue to the Albanian Alps or Montenegro with a private driver from Tirana Airport.",
  },
  theth: {
    distance: "≈ 175 km from Tirana International Airport (TIA)",
    duration: "≈ 3–3.5 hours by car (mountain road)",
    whyBook:
      "Theth's mountain road isn't for every rental car—our drivers know the route so you arrive ready to hike, not white-knuckled from a late night improvised taxi.",
  },
}

function destinationDefaults(slug: string): PageDefinition | null {
  const dest = DESTINATIONS.find((d) => d.id === slug)
  if (!dest) return null
  return destinationDefinitionFromMeta(dest)
}

export function destinationDefinitionFromMeta(dest: Destination): PageDefinition {
  const route = DESTINATION_ROUTE_INFO[dest.id]
  const document = destinationDocumentFromSeed(dest, route)
  const publicSlug = document.meta.slug || dest.id
  return {
    slug: `destinations/${dest.id}`,
    label: `Destination · ${dest.name}`,
    path: `/destinations/${publicSlug}`,
    defaults: {
      title: `${dest.name} airport transfer`,
      description: dest.description,
      ogImage: dest.image,
      // Visual content lives on destinationDocument (v2). Flat sections unused.
      sections: [],
      destinationDocument: document,
    },
  }
}

export function isBuiltInDestinationId(id: string): boolean {
  return DESTINATIONS.some((d) => d.id === id)
}

export function isDestinationSlug(slug: string): boolean {
  return slug.startsWith("destinations/")
}

export function destinationIdFromSlug(slug: string): string | null {
  if (!isDestinationSlug(slug)) return null
  const id = slug.slice("destinations/".length)
  return id || null
}

export function isBuiltInBlogId(id: string): boolean {
  return BLOG_POSTS.some((post) => post.slug === id)
}

export function blogDefinitionFromPost(post: (typeof BLOG_POSTS)[number]): PageDefinition {
  const sections = blogPostToSections(post)
  return {
    slug: `blog/${post.slug}`,
    label: `Blog · ${post.title}`,
    path: `/blog/${post.slug}`,
    defaults: {
      title: post.seoTitle,
      description: post.seoDescription,
      ogImage: post.heroImage.src,
      sections,
    },
  }
}

function blogDefinitionFromRow(row: {
  slug: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: unknown
}): PageDefinition {
  const id = blogIdFromSlug(row.slug) || row.slug
  const sections = parseSections(row.sections)
  const title =
    sectionHeading(sections, "title.heading") ||
    row.label.replace(/^Blog\s*·\s*/i, "").trim() ||
    id
  return {
    slug: row.slug,
    label: row.label || `Blog · ${title}`,
    path: `/blog/${id}`,
    defaults: {
      title: row.title || title,
      description: row.description || "",
      ogImage: row.ogImage || "",
      sections:
        sections.length > 0
          ? sections
          : emptyBlogSections(title),
    },
  }
}

/** Public URL segment for a destination (`meta.slug` / legacy `urlSlug`, else id). */
export function publicDestinationSlug(
  sectionsOrDoc: PageSection[] | DestinationDocument | unknown,
  id: string,
): string {
  if (isDestinationDocumentV2(sectionsOrDoc)) {
    const slug = slugifyDestinationId(sectionsOrDoc.meta.slug.trim())
    return slug || id
  }
  if (Array.isArray(sectionsOrDoc)) {
    const raw = sectionValue(sectionsOrDoc as PageSection[], "urlSlug").trim()
    const slug = slugifyDestinationId(raw)
    return slug || id
  }
  return id
}

const HIDDEN_STATUS_KEY = "_status"
const FEATURED_STATUS_KEY = "_featured"

/** Hidden flag — accepts legacy section arrays, v2 documents, or raw DB JSON. */
export function isDestinationHidden(sections: unknown): boolean {
  return destinationStorageIsHidden(sections)
}

/** Featured flag — accepts legacy section arrays, v2 documents, or raw DB JSON. */
export function isDestinationFeatured(sections: unknown): boolean {
  return destinationStorageIsFeatured(sections)
}

function defaultDestinationDocument(
  def: PageDefinition,
  id: string,
): DestinationDocument {
  if (def.defaults.destinationDocument) {
    return parseDestinationDocument(def.defaults.destinationDocument, {
      id,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: def.defaults.ogImage,
    })
  }
  return parseDestinationDocument(def.defaults.sections, {
    id,
    title: def.defaults.title,
    description: def.defaults.description,
    ogImage: def.defaults.ogImage,
  })
}

function withHiddenStatus(sections: PageSection[]): PageSection[] {
  const without = sections.filter((s) => s.key !== HIDDEN_STATUS_KEY)
  return [
    ...without,
    section("text", HIDDEN_STATUS_KEY, { body: "hidden" }),
  ]
}

function withFeaturedStatus(sections: PageSection[]): PageSection[] {
  const without = sections.filter((s) => s.key !== FEATURED_STATUS_KEY)
  return [
    ...without,
    section("text", FEATURED_STATUS_KEY, { body: "featured" }),
  ]
}

function withoutFeaturedStatus(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.key !== FEATURED_STATUS_KEY)
}

/** Keep soft-hide / homepage-star meta when the editor saves visible sections. */
export function preserveDestinationMetaKeys(
  next: PageSection[],
  previous: PageSection[],
): PageSection[] {
  let sections = next.filter(
    (s) => s.key !== HIDDEN_STATUS_KEY && s.key !== FEATURED_STATUS_KEY,
  )
  // Blog editors send `meta.*` + optional `_featured`; trust featured from next.
  // Destination editors drop meta keys via merge — preserve featured from previous.
  const blogShaped = next.some((s) => s.key.startsWith("meta."))
  if (
    blogShaped
      ? isDestinationFeatured(next)
      : isDestinationFeatured(previous)
  ) {
    sections = withFeaturedStatus(sections)
  }
  if (isDestinationHidden(previous)) {
    sections = withHiddenStatus(sections)
  }
  return sections
}

function pageDefinitionFromRow(row: {
  slug: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: unknown
}): PageDefinition {
  const id = destinationIdFromSlug(row.slug) || row.slug
  const document = parseDestinationDocument(row.sections, {
    id,
    title: row.title,
    description: row.description,
    ogImage: row.ogImage,
  })
  const name =
    document.meta.title ||
    row.label.replace(/^Destination\s*·\s*/i, "").trim() ||
    id
  return {
    slug: row.slug,
    label: row.label || `Destination · ${name}`,
    path: `/destinations/${publicDestinationSlug(document, id)}`,
    defaults: {
      title: row.title || `${name} airport transfer`,
      description: row.description || document.meta.description || "",
      ogImage: row.ogImage || destinationHeroImage(document) || "",
      sections: isDestinationDocumentV2(row.sections)
        ? []
        : parseSections(row.sections).length > 0
          ? parseSections(row.sections)
          : [],
      destinationDocument: document,
    },
  }
}

export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    slug: "home",
    label: "Homepage",
    path: "/",
    defaults: HOME_DEFAULTS,
  },
  {
    slug: "blog",
    label: "Blog archive",
    path: "/blog",
    defaults: BLOG_ARCHIVE_DEFAULTS,
  },
  {
    slug: "cancellation-policy",
    label: "Cancellation Policy",
    path: "/cancellation-policy",
    defaults: CANCELLATION_DEFAULTS,
  },
  {
    slug: "privacy-policy",
    label: "Privacy Policy",
    path: "/privacy-policy",
    defaults: PRIVACY_DEFAULTS,
  },
  {
    slug: "terms",
    label: "Terms & Conditions",
    path: "/terms",
    defaults: TERMS_DEFAULTS,
  },
  {
    slug: "cookies",
    label: "Cookie Policy",
    path: "/cookies",
    defaults: COOKIES_DEFAULTS,
  },
  ...DESTINATIONS.map((d) => destinationDefaults(d.id)!),
  ...BLOG_POSTS.map((post) => blogDefinitionFromPost(post)),
]

export function getPageDefinition(slug: string): PageDefinition | undefined {
  return PAGE_DEFINITIONS.find((p) => p.slug === slug)
}

/** Built-in definition, or a custom destination/blog row from the database. */
export async function resolvePageDefinition(
  slug: string,
): Promise<PageDefinition | undefined> {
  const builtIn = getPageDefinition(slug)
  if (builtIn) return builtIn
  if (!isDestinationSlug(slug) && !isBlogSlug(slug)) return undefined
  const row =
    (await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
    })) ??
    (await prisma.pageContent.findFirst({ where: { slug } }))
  if (!row) return undefined
  if (isBlogSlug(slug)) return blogDefinitionFromRow(row)
  return pageDefinitionFromRow(row)
}

export function serializePageContent(
  row: {
  slug: string
    locale?: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: unknown
  updatedAt: Date
  },
  opts?: { hasLocaleRow?: boolean },
): PageContentRecord {
  const id = destinationIdFromSlug(row.slug)
  const destinationDocument =
    id != null
      ? parseDestinationDocument(row.sections, {
          id,
          title: row.title,
          description: row.description,
          ogImage: row.ogImage,
          updatedAt: row.updatedAt.toISOString(),
        })
      : undefined

  return {
    slug: row.slug,
    locale: row.locale ?? DEFAULT_LOCALE,
    label: row.label,
    title: row.title,
    description: row.description,
    ogImage: row.ogImage,
    sections:
      destinationDocument && isDestinationDocumentV2(row.sections)
        ? []
        : parseSections(row.sections),
    destinationDocument,
    updatedAt: row.updatedAt.toISOString(),
    fromDatabase: true,
    hasLocaleRow: opts?.hasLocaleRow ?? true,
  }
}

function normalizeLocale(locale?: string | null): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}

/**
 * Public site resolution: prefer locale row, fall back to English content,
 * then code defaults.
 */
export async function resolvePageContent(
  slug: string,
  localeInput?: string | null,
): Promise<PageContentRecord | null> {
  const locale = normalizeLocale(localeInput)
  const def = await resolvePageDefinition(slug)
  if (!def) return null

  const localized = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale } },
  })
  const english =
    locale === DEFAULT_LOCALE
      ? localized
      : await prisma.pageContent.findUnique({
          where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
        })

  const isCustomDestination =
    isDestinationSlug(slug) &&
    !isBuiltInDestinationId(destinationIdFromSlug(slug) || "")
  const isCustomBlog =
    isBlogSlug(slug) && !isBuiltInBlogId(blogIdFromSlug(slug) || "")

  const hideSource = english ?? localized
  if (
    hideSource &&
    (isDestinationSlug(slug) || isBlogSlug(slug)) &&
    isDestinationHidden(hideSource.sections)
  ) {
    return null
  }

  const destId = destinationIdFromSlug(slug)

  // Destination pages: dual-read v2 / legacy into DestinationDocument.
  if (destId) {
    const baseDoc = english
      ? parseDestinationDocument(english.sections, {
          id: destId,
          title: english.title,
          description: english.description,
          ogImage: english.ogImage,
          updatedAt: english.updatedAt.toISOString(),
        })
      : defaultDestinationDocument(def, destId)

    const localizedDoc =
      localized && locale !== DEFAULT_LOCALE
        ? parseDestinationDocument(localized.sections, {
            id: destId,
            title: localized.title,
            description: localized.description,
            ogImage: localized.ogImage,
            updatedAt: localized.updatedAt.toISOString(),
          })
        : null

    const document =
      localizedDoc != null
        ? mergeDestinationDocuments(localizedDoc, baseDoc)
        : baseDoc

    if (!document.meta.canonicalUrl) {
      document.meta.canonicalUrl = `/destinations/${publicDestinationSlug(document, destId)}`
    }
    if (!document.meta.updatedAt && (localized ?? english)) {
      document.meta.updatedAt = (localized ?? english)!.updatedAt.toISOString()
    }

    const row = localized ?? english
  if (!row) {
      if (isCustomDestination) return null
      const hero = destinationHeroImage(document)
    return {
      slug: def.slug,
        locale: DEFAULT_LOCALE,
        label: def.label,
        title: def.defaults.title,
        description: def.defaults.description,
        ogImage: hero || def.defaults.ogImage,
        sections: [],
        destinationDocument: document,
        fromDatabase: false,
        hasLocaleRow: false,
      }
    }

    const title =
      localized?.title?.trim() ||
      english?.title?.trim() ||
      document.meta.title ||
      def.defaults.title
    const description =
      localized?.description?.trim() ||
      english?.description?.trim() ||
      document.meta.description ||
      def.defaults.description
    const rawOg =
      localized?.ogImage?.trim() ||
      english?.ogImage?.trim() ||
      def.defaults.ogImage
    const heroSrc = destinationHeroImage(document)
    const ogImage =
      [heroSrc, rawOg, def.defaults.ogImage].find((url) =>
        Boolean(url && url.startsWith("/uploads/")),
      ) ||
      heroSrc ||
      rawOg ||
      def.defaults.ogImage

    return {
      slug: row.slug,
      locale,
      label: localized?.label || english?.label || def.label,
      title,
      description,
      ogImage,
      sections: isDestinationDocumentV2(row.sections)
        ? []
        : parseSections(
            (english ?? localized)?.sections ?? row.sections,
          ),
      destinationDocument: document,
      updatedAt: row.updatedAt.toISOString(),
      fromDatabase: true,
      hasLocaleRow: Boolean(localized),
    }
  }

  const row = localized ?? english
  if (!row) {
    if (isCustomBlog) return null
    return {
      slug: def.slug,
      locale: DEFAULT_LOCALE,
      label: def.label,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: def.defaults.ogImage,
      sections: def.defaults.sections,
      fromDatabase: false,
      hasLocaleRow: false,
    }
  }

  const localizedSections = localized ? parseSections(localized.sections) : []
  const englishSectionsRaw = english ? parseSections(english.sections) : []
  const englishSections = englishSectionsRaw
  const baseSections =
    englishSections.length > 0
      ? englishSections
      : localizedSections.length > 0
        ? localizedSections
        : def.defaults.sections

  const sections =
    locale !== DEFAULT_LOCALE && localized
      ? mergeLocalizedSections(localizedSections, baseSections)
      : baseSections.length > 0
        ? baseSections
        : def.defaults.sections

  const title =
    localized?.title?.trim() || english?.title?.trim() || def.defaults.title
  const description =
    localized?.description?.trim() ||
    english?.description?.trim() ||
    def.defaults.description
  const ogImage =
    localized?.ogImage?.trim() ||
    english?.ogImage?.trim() ||
    def.defaults.ogImage

  return {
    slug: row.slug,
    locale,
    label: localized?.label || english?.label || def.label,
    title,
    description,
    ogImage,
    sections,
    updatedAt: row.updatedAt.toISOString(),
    fromDatabase: true,
    hasLocaleRow: Boolean(localized),
  }
}

/**
 * Admin editor resolution: if the locale has no row yet, return an empty
 * editable shell (structure from EN/defaults) so translators start blank.
 */
export async function resolvePageContentForAdmin(
  slug: string,
  localeInput?: string | null,
): Promise<PageContentRecord | null> {
  const locale = normalizeLocale(localeInput)
  if (locale === DEFAULT_LOCALE) {
    return resolvePageContent(slug, locale)
  }

  const def = await resolvePageDefinition(slug)
  if (!def) return null

  const destId = destinationIdFromSlug(slug)

  if (destId) {
    const localized = await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale } },
    })
    const english = await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
    })
    const baseDoc = english
      ? parseDestinationDocument(english.sections, {
          id: destId,
          title: english.title,
          description: english.description,
          ogImage: english.ogImage,
          updatedAt: english.updatedAt.toISOString(),
        })
      : defaultDestinationDocument(def, destId)

    if (localized) {
      const document = parseDestinationDocument(localized.sections, {
        id: destId,
        title: localized.title,
        description: localized.description,
        ogImage: localized.ogImage,
        updatedAt: localized.updatedAt.toISOString(),
      })
      return {
        ...serializePageContent(localized, { hasLocaleRow: true }),
        destinationDocument: document,
        sections: [],
      }
    }

    const blank = blankDestinationDocumentForLocale(baseDoc)
    return {
      slug: def.slug,
      locale,
      label: english?.label || def.label,
      title: "",
      description: "",
      ogImage: destinationHeroImage(baseDoc) || def.defaults.ogImage,
      sections: [],
      destinationDocument: blank,
      fromDatabase: false,
      hasLocaleRow: false,
      updatedAt: english?.updatedAt.toISOString(),
    }
  }

  const localized = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale } },
  })

  if (localized) {
    return serializePageContent(localized, { hasLocaleRow: true })
  }

  const english = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
  })
  const base = english
    ? serializePageContent(english, { hasLocaleRow: false })
    : {
        slug: def.slug,
        locale: DEFAULT_LOCALE,
        label: def.label,
        title: def.defaults.title,
        description: def.defaults.description,
        ogImage: def.defaults.ogImage,
        sections: def.defaults.sections,
        fromDatabase: false,
        hasLocaleRow: false,
      }

  return {
    slug: def.slug,
    locale,
    label: base.label,
    title: "",
    description: "",
    ogImage: base.ogImage,
    sections: base.sections.map((section) => {
      if (section.type === "image") return { ...section }
      if (section.type === "heading") return { ...section, heading: "" }
      if (section.type === "text") return { ...section, body: "" }
      if (section.type === "faq_item") {
        return { ...section, question: "", answer: "" }
      }
      if (section.type === "attraction") {
        return { ...section, heading: "", body: "", alt: section.alt ?? "" }
      }
      return { ...section }
    }),
    fromDatabase: false,
    hasLocaleRow: false,
    updatedAt: base.updatedAt,
  }
}

export type AdminPageListItem = {
  slug: string
  label: string
  path: string
  title: string
  updatedAt: string | null
  fromDatabase: boolean
  /** Permanent delete (custom destinations / blogs). */
  canDelete: boolean
  /** Clear DB overrides and restore code defaults. */
  canReset: boolean
  isCustomDestination: boolean
  isCustomBlog: boolean
  /** Destination pages only — homepage carousel star. */
  isDestination: boolean
  isBlog: boolean
  featured: boolean
}

export async function listAdminPages(): Promise<AdminPageListItem[]> {
  const rows = await prisma.pageContent.findMany({
    where: { locale: DEFAULT_LOCALE },
    select: {
      slug: true,
      label: true,
      title: true,
      description: true,
      ogImage: true,
      sections: true,
      updatedAt: true,
    },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const builtIn = PAGE_DEFINITIONS.map((def) => {
    const row = bySlug.get(def.slug)
    const isDestination = isDestinationSlug(def.slug)
    const isBlog = isBlogSlug(def.slug)
    const destId = destinationIdFromSlug(def.slug)
    const rawSections = row?.sections
    const sections = row ? parseSections(row.sections) : []
    const document =
      isDestination && destId
        ? row
          ? parseDestinationDocument(row.sections, {
              id: destId,
              title: row.title,
              description: row.description,
              ogImage: row.ogImage,
            })
          : defaultDestinationDocument(def, destId)
        : null
    const hidden =
      (isDestination || isBlog) && row
        ? isDestinationHidden(rawSections)
        : false
    if (hidden) return null
    const path =
      isDestination && destId
        ? `/destinations/${publicDestinationSlug(
            document ?? (sections.length ? sections : def.defaults.sections),
            destId,
          )}`
        : def.path
    return {
      slug: def.slug,
      label: row?.label || def.label,
      path,
      title: row?.title || def.defaults.title,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      fromDatabase: Boolean(row),
      canDelete: isDestination || isBlog,
      canReset: !isDestination && !isBlog && Boolean(row),
      isCustomDestination: false,
      isCustomBlog: false,
      isDestination,
      isBlog,
      featured:
        (isDestination || isBlog) && row
          ? isDestinationFeatured(rawSections)
          : isBlog && !row
            ? isDestinationFeatured(def.defaults.sections)
            : false,
    }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))

  const builtInSlugs = new Set(PAGE_DEFINITIONS.map((d) => d.slug))
  const custom = rows
    .filter((row) => {
      if (builtInSlugs.has(row.slug)) return false
      if (isDestinationSlug(row.slug)) {
        return !isDestinationHidden(row.sections)
      }
      if (isBlogSlug(row.slug)) {
        return !isDestinationHidden(row.sections)
      }
      return false
    })
    .map((row) => {
      const isBlog = isBlogSlug(row.slug)
      const def = isBlog
        ? blogDefinitionFromRow(row)
        : pageDefinitionFromRow(row)
      return {
        slug: row.slug,
        label: row.label || def.label,
        path: def.path,
        title: row.title || def.defaults.title,
        updatedAt: row.updatedAt.toISOString(),
        fromDatabase: true,
        canDelete: true,
        canReset: false,
        isCustomDestination: !isBlog,
        isCustomBlog: isBlog,
        isDestination: !isBlog,
        isBlog,
        featured: isDestinationFeatured(row.sections),
      }
    })

  return [...builtIn, ...custom]
}

/** Public path for a CMS slug (`home` → `/`, `destinations/x` → `/destinations/x`). */
export function pathForSlug(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`
}

export function pageMetadataFields(page: PageContentRecord) {
  const destId = destinationIdFromSlug(page.slug)
  const path =
    destId != null
      ? `/destinations/${
          page.destinationDocument
            ? publicDestinationSlug(page.destinationDocument, destId)
            : publicDestinationSlug(page.sections, destId)
        }`
      : pathForSlug(page.slug)
  const ogImage = page.ogImage || DEFAULT_OG_IMAGE

  return {
    title: page.title,
    description: page.description,
    alternates: localizedAlternates(
      path,
      (page.locale as Locale) || DEFAULT_LOCALE,
    ),
    openGraph: {
      title: page.title,
      description: page.description,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: page.title },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: page.title,
      description: page.description,
      images: [ogImage],
    },
  }
}

/** List public blog posts for a locale (CMS + built-in defaults). */
export async function listBlogPostsFromCms(
  localeInput?: string | null,
): Promise<NonNullable<ReturnType<typeof pageContentToBlogPost>>[]> {
  const locale = normalizeLocale(localeInput)
  const defs = PAGE_DEFINITIONS.filter((d) => isBlogSlug(d.slug))
  const builtInSlugs = new Set(defs.map((d) => d.slug))

  const rows = await prisma.pageContent.findMany({
    where: {
      locale: DEFAULT_LOCALE,
      slug: { startsWith: "blog/" },
    },
    select: { slug: true },
  })

  const slugs = new Set([
    ...defs.map((d) => d.slug),
    ...rows.map((r) => r.slug).filter((s) => !builtInSlugs.has(s)),
  ])

  const posts: NonNullable<ReturnType<typeof pageContentToBlogPost>>[] = []
  for (const slug of slugs) {
    const page = await resolvePageContent(slug, locale)
    if (!page) continue
    const post = pageContentToBlogPost(page)
    if (post) posts.push(post)
  }

  return posts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export async function getBlogPostFromCms(
  postSlug: string,
  localeInput?: string | null,
) {
  const page = await resolvePageContent(`blog/${postSlug}`, localeInput)
  if (!page) return null
  return pageContentToBlogPost(page)
}

function destinationCardImage(
  sections: PageSection[],
  ogImage: string,
  fallback: string,
) {
  const hero = sectionValue(sections, "hero", "src")
  const anyImage =
    sections.find((s) => s.type === "image" && s.src)?.src ?? ""
  const candidates = [hero, ogImage, anyImage, fallback].filter(Boolean)
  // Prefer a local upload over stock Unsplash defaults.
  const uploaded = candidates.find((url) => url.startsWith("/uploads/"))
  if (uploaded) return uploaded
  return hero || ogImage || anyImage || fallback
}

function destinationFromPage(
  id: string,
  page: PageContentRecord,
  fallback?: Destination,
): Destination {
  const document =
    page.destinationDocument ??
    parseDestinationDocument(page.sections, {
      id,
      title: page.title,
      description: page.description,
      ogImage: page.ogImage,
      updatedAt: page.updatedAt,
    })
  const hero = getDestinationHero(document)
  const card = destinationMetaToCardFields(document.meta, {
    id,
    image: hero?.src || page.ogImage || fallback?.image || "",
    imageAlt: hero?.alt || fallback?.name || document.meta.title,
  })
  const name = card.name || fallback?.name || id
  const imageCandidates = [
    card.image,
    page.ogImage ?? "",
    fallback?.image || "",
  ].filter(Boolean)
  const image =
    imageCandidates.find((url) => url.startsWith("/uploads/")) ||
    card.image ||
    page.ogImage ||
    fallback?.image ||
    ""

  return {
    id,
    slug: card.slug || id,
    name,
    region: card.region || fallback?.region || "",
    description: card.description || fallback?.description || "",
    badge: card.badge || fallback?.badge || "New",
    priceFrom: card.priceFrom || fallback?.priceFrom || "€—",
    image,
    imageAlt: card.imageAlt || "",
    travelTime: card.travelTime || fallback?.travelTime || "",
    primaryKeyword:
      card.primaryKeyword || fallback?.primaryKeyword || "",
    reviewKeywords: fallback?.reviewKeywords?.length
      ? fallback.reviewKeywords
      : [name],
  }
}

/**
 * Resolve a destination CMS page + parsed DestinationDocument (v2 or legacy).
 */
export async function resolveDestinationPage(
  id: string,
  localeInput?: string | null,
): Promise<{ page: PageContentRecord; document: DestinationDocument } | null> {
  const page = await resolvePageContent(`destinations/${id}`, localeInput)
  if (!page?.destinationDocument) return null
  return { page, document: page.destinationDocument }
}

/** Destination cards for the homepage carousel (CMS with code fallbacks). */
export async function resolveDestinationCards(
  localeInput?: string | null,
  options?: { featuredOnly?: boolean },
): Promise<Destination[]> {
  const locale = normalizeLocale(localeInput)
  const builtInCards = (
    await Promise.all(
    DESTINATIONS.map(async (dest) => {
        const page = await resolvePageContent(`destinations/${dest.id}`, locale)
        if (!page) return null
      return {
          card: destinationFromPage(dest.id, page, dest),
          featured: Boolean(page.destinationDocument?.flags?.featured) ||
            isDestinationFeatured(page.sections),
        }
      }),
    )
  ).filter(
    (item): item is { card: Destination; featured: boolean } => Boolean(item),
  )

  const builtInIds = new Set(DESTINATIONS.map((d) => d.id))
  const customRows = await prisma.pageContent.findMany({
    where: {
      slug: { startsWith: "destinations/" },
      locale: { in: [locale, DEFAULT_LOCALE] },
    },
  })

  const bySlug = new Map<string, (typeof customRows)[number]>()
  for (const row of customRows) {
    const existing = bySlug.get(row.slug)
    if (!existing || row.locale === locale) {
      bySlug.set(row.slug, row)
    }
  }

  const customCards = [...bySlug.values()]
    .map((row) => {
      const id = destinationIdFromSlug(row.slug)
      if (!id || builtInIds.has(id)) return null
      const page = serializePageContent(row)
      if (isDestinationHidden(row.sections)) return null
      if (row.locale !== locale && row.locale !== DEFAULT_LOCALE) return null
      const enRow =
        row.locale === DEFAULT_LOCALE
          ? row
          : customRows.find(
              (r) => r.slug === row.slug && r.locale === DEFAULT_LOCALE,
            )
      const card = destinationFromPage(id, page)
      // Fares are EN-canonical — never show a translated/stale locale price.
      if (enRow && row.locale !== DEFAULT_LOCALE) {
        const enDoc = parseDestinationDocument(enRow.sections, {
          id,
          title: enRow.title,
          description: enRow.description,
          ogImage: enRow.ogImage,
        })
        if (enDoc?.meta.priceFrom) {
          card.priceFrom = enDoc.meta.priceFrom
        }
      }
      return {
        card,
        featured: isDestinationFeatured(
          enRow?.sections ?? row.sections,
        ),
      }
    })
    .filter(
      (item): item is { card: Destination; featured: boolean } => Boolean(item),
    )

  let selected = [...builtInCards, ...customCards]
  if (options?.featuredOnly) {
    const featured = selected.filter((item) => item.featured)
    // Until at least one destination is starred, keep showing all (safe rollout).
    if (featured.length > 0) selected = featured
  }

  const cards = selected.map((item) => item.card)
  const byUrl = await mediaMetaByUrls(cards.map((card) => card.image))
  return cards.map((card) => {
    const meta = byUrl.get(card.image)
    return {
      ...card,
      imageAlt: resolveMediaAlt(meta, card.name),
    }
  })
}

/**
 * Toggle feature star for a destination (homepage carousel) or blog post (archive).
 * Upserts EN PageContent so built-ins without a row can be starred.
 */
export async function setDestinationFeatured(
  slug: string,
  featured: boolean,
): Promise<{ featured: boolean }> {
  if (!isDestinationSlug(slug) && !isBlogSlug(slug)) {
    throw new Error("Only destination or blog pages can be featured.")
  }

  const def = await resolvePageDefinition(slug)
  if (!def) {
    throw new Error("Unknown page.")
  }

  const existing = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
  })

  if (isDestinationSlug(slug)) {
    const destId = destinationIdFromSlug(slug) || slug
    const baseDoc = existing
      ? parseDestinationDocument(existing.sections, {
          id: destId,
          title: existing.title,
          description: existing.description,
          ogImage: existing.ogImage,
        })
      : defaultDestinationDocument(def, destId)

    if (existing && isDestinationDocumentHidden(baseDoc)) {
      throw new Error("This page is deleted.")
    }

    const nextDoc = withDestinationFeatured(baseDoc, featured)
    const payload = serializeDestinationDocument(nextDoc)
    const hero = destinationHeroImage(nextDoc)

    await prisma.pageContent.upsert({
      where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
      create: {
        slug,
        locale: DEFAULT_LOCALE,
        label: def.label,
        title: def.defaults.title,
        description: def.defaults.description,
        ogImage: hero || def.defaults.ogImage,
        sections: payload,
      },
      update: {
        sections: payload,
      },
    })

    return { featured }
  }

  const baseSections = existing
    ? parseSections(existing.sections)
    : def.defaults.sections

  if (existing && isDestinationHidden(existing.sections)) {
    throw new Error("This page is deleted.")
  }

  const nextSections = featured
    ? withFeaturedStatus(baseSections)
    : withoutFeaturedStatus(baseSections)

  await prisma.pageContent.upsert({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
    create: {
      slug,
      locale: DEFAULT_LOCALE,
      label: def.label,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: def.defaults.ogImage,
      sections: nextSections,
    },
    update: {
      sections: nextSections,
    },
  })

  return { featured }
}

export async function createBlogPage(input: {
  title: string
  slug?: string
}) {
  const title = input.title.trim()
  if (!title) throw new Error("Title is required.")

  const id = slugifyBlogId(input.slug?.trim() || title)
  if (!id) throw new Error("Enter a valid slug (letters and numbers).")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens.")
  }

  const slug = `blog/${id}`
  const existing = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
  })
  const existingHidden =
    existing != null && isDestinationHidden(existing.sections)

  if (isBuiltInBlogId(id) && !existingHidden) {
    throw new Error("That blog post already exists.")
  }
  if (existing && !existingHidden) {
    throw new Error("That blog post already exists.")
  }

  const sections = emptyBlogSections(title)
  const data = {
    label: `Blog · ${title}`,
    title: title.slice(0, 60),
    description: `Travel guide: ${title}`.slice(0, 155),
    ogImage:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1600",
    sections,
  }

  const row = existingHidden
    ? await prisma.pageContent.update({
        where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
        data,
      })
    : await prisma.pageContent.create({
        data: {
          slug,
          locale: DEFAULT_LOCALE,
          ...data,
        },
      })

  return serializePageContent(row)
}

export async function resolveDestination(
  slugOrId: string,
  localeInput?: string | null,
): Promise<Destination | null> {
  const cards = await resolveDestinationCards(localeInput)
  return (
    cards.find(
      (card) => card.slug === slugOrId || card.id === slugOrId,
    ) ?? null
  )
}

export async function createDestinationPage(input: {
  name: string
  id?: string
  region?: string
  description?: string
  badge?: string
  priceFrom?: string
  image?: string
  travelTime?: string
  primaryKeyword?: string
}) {
  const name = input.name.trim()
  if (!name) throw new Error("Name is required.")

  const id = slugifyDestinationId(input.id?.trim() || name)
  if (!id) throw new Error("Enter a valid destination id (letters and numbers).")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("Id must be lowercase letters, numbers, and hyphens.")
  }

  const slug = `destinations/${id}`
  const existing = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
  })
  const existingHidden =
    existing != null && isDestinationHidden(existing.sections)

  if (isBuiltInDestinationId(id) && !existingHidden) {
    throw new Error("That destination already exists.")
  }
  if (existing && !existingHidden) {
    throw new Error("That destination already exists.")
  }

  const dest: Destination = {
    id,
    slug: id,
    name,
    region: input.region?.trim() || "Albania",
    description:
      input.description?.trim() ||
      `Airport transfers to ${name}.`,
    badge: input.badge?.trim() || "New",
    priceFrom: input.priceFrom?.trim() || "€—",
    image:
      input.image?.trim() ||
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800",
    travelTime: input.travelTime?.trim() || "",
    primaryKeyword: input.primaryKeyword?.trim() || "",
    reviewKeywords: [name],
  }

  const def = destinationDefinitionFromMeta(dest)
  const document = serializeDestinationDocument(
    def.defaults.destinationDocument ??
      destinationDocumentFromSeed(dest, DESTINATION_ROUTE_INFO[dest.id]),
  )
  const data = {
    label: def.label,
    title: def.defaults.title,
    description: def.defaults.description,
    ogImage: def.defaults.ogImage,
    sections: document,
  }
  const row = existingHidden
    ? await prisma.pageContent.update({
        where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
        data,
      })
    : await prisma.pageContent.create({
        data: {
          slug,
          locale: DEFAULT_LOCALE,
          ...data,
        },
      })

  return serializePageContent(row)
}

export async function deleteAdminPage(slug: string): Promise<{
  mode: "deleted" | "reset"
}> {
  const def = await resolvePageDefinition(slug)
  if (!def && !isDestinationSlug(slug) && !isBlogSlug(slug)) {
    throw new Error("Unknown page.")
  }

  const destId = destinationIdFromSlug(slug)
  const blogId = blogIdFromSlug(slug)
  const isCustomDest = Boolean(destId && !isBuiltInDestinationId(destId))
  const isCustomBlog = Boolean(blogId && !isBuiltInBlogId(blogId))

  if (isCustomDest || isCustomBlog) {
    await prisma.pageContent.deleteMany({ where: { slug } })
    return { mode: "deleted" }
  }

  if (
    (destId && isBuiltInDestinationId(destId)) ||
    (blogId && isBuiltInBlogId(blogId))
  ) {
    const existing = await prisma.pageContent.findUnique({
      where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
    })

    if (destId && isBuiltInDestinationId(destId)) {
      const baseDoc = existing
        ? parseDestinationDocument(existing.sections, {
            id: destId,
            title: existing.title,
            description: existing.description,
            ogImage: existing.ogImage,
          })
        : defaultDestinationDocument(
            def ?? destinationDefinitionFromMeta({
              id: destId,
              slug: destId,
              name: destId,
              region: "",
              description: "",
              badge: "New",
              priceFrom: "€—",
              image: "",
              travelTime: "",
              primaryKeyword: "",
              reviewKeywords: [destId],
            }),
            destId,
          )
      const hiddenDoc = serializeDestinationDocument(
        withDestinationHidden(baseDoc, true),
      )
      await prisma.pageContent.upsert({
        where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
        create: {
          slug,
          locale: DEFAULT_LOCALE,
          label: def?.label || `Destination · ${destId}`,
          title: def?.defaults.title || destId,
          description: def?.defaults.description || "",
          ogImage: def?.defaults.ogImage || "",
          sections: hiddenDoc,
        },
        update: {
          sections: hiddenDoc,
        },
      })
      await prisma.pageContent.deleteMany({
        where: { slug, locale: { not: DEFAULT_LOCALE } },
      })
      return { mode: "deleted" }
    }

    const baseSections = existing
      ? parseSections(existing.sections).filter((s) => s.key !== HIDDEN_STATUS_KEY)
      : def?.defaults.sections ?? []
    const labelFallback = `Blog · ${blogId}`
    await prisma.pageContent.upsert({
      where: { slug_locale: { slug, locale: DEFAULT_LOCALE } },
      create: {
        slug,
        locale: DEFAULT_LOCALE,
        label: def?.label || labelFallback,
        title: def?.defaults.title || blogId || slug,
        description: def?.defaults.description || "",
        ogImage: def?.defaults.ogImage || "",
        sections: withHiddenStatus(
          baseSections.length ? baseSections : def?.defaults.sections ?? [],
        ),
      },
      update: {
        sections: withHiddenStatus(
          baseSections.length ? baseSections : def?.defaults.sections ?? [],
        ),
      },
    })
    await prisma.pageContent.deleteMany({
      where: { slug, locale: { not: DEFAULT_LOCALE } },
    })
    return { mode: "deleted" }
  }

  if (isCorePageSlug(slug)) {
    const existing = await prisma.pageContent.findFirst({ where: { slug } })
    if (!existing) throw new Error("Nothing to reset — this page uses defaults.")
    await prisma.pageContent.deleteMany({ where: { slug } })
    return { mode: "reset" }
  }

  throw new Error("This page cannot be deleted.")
}

/**
 * Homepage copy with media-library alt applied to hero / uber-alt / safety images.
 * Visible headings and body copy always come from page sections
 * (/admin/pages/home); media title/description only feed alt text.
 */
export async function resolveHomeMarketingCopy(
  sections: PageSection[],
  ogImage?: string | null,
): Promise<HomeMarketingCopy> {
  const copy = homeCopyFromSections(sections)
  const heroFromOg = ogImage?.trim()
  if (heroFromOg) {
    copy.hero.image = heroFromOg
  }
  const urls = [
    copy.hero.image,
    copy.uberAlt.image,
    ...copy.safety.items.map((item) => item.image),
  ]
  const byUrl = await mediaMetaByUrls(urls)

  const heroMeta = byUrl.get(copy.hero.image)
  copy.hero.imageAlt = resolveMediaAlt(heroMeta, copy.hero.imageAlt.trim())

  const uberAltMeta = byUrl.get(copy.uberAlt.image)
  copy.uberAlt.imageAlt = resolveMediaAlt(
    uberAltMeta,
    copy.uberAlt.imageAlt.trim(),
  )

  copy.safety.items = copy.safety.items.map((item) => {
    const meta = byUrl.get(item.image)
    const title = item.title.trim()
    return {
      ...item,
      title,
      description: item.description.trim(),
      alt: resolveMediaAlt(meta, title || item.alt.trim()),
    }
  })

  return copy
}
