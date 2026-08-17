import { getDestination } from "@/lib/destinations"

export type DurationRange = {
  /** Lower bound in minutes (inclusive). */
  minMinutes: number
  /** Upper bound in minutes (inclusive). */
  maxMinutes: number
  /** Display label, e.g. "3.5–4 hrs". */
  label: string
}

export type ComparisonOption = {
  mode: string
  typicalTime: string
  changes: string
  priceClarity: string
  /** Highlight our private transfer row. */
  highlight?: boolean
}

export type RouteFaq = {
  question: string
  answer: string
}

export type RouteInsight = {
  title: string
  body: string
}

export type TransferRoute = {
  slug: string
  origin: string
  destinationName: string
  /** Alternate spellings for dual-intent SEO (e.g. Saranda alongside Sarandë). */
  nameVariants: string[]
  /** Marketing destination id when linked (`sarande`, `vlore`, …). */
  destinationId: string
  /** Prisma zone name used for live fare lookup. */
  zoneName: string
  distanceKm: number
  duration: DurationRange
  /** Live sedan fare when zone pricing is available; otherwise catalog fallback. */
  priceEur: number
  /** True when `priceEur` came from `calculatePriceForZone`. */
  priceFromLiveQuote: boolean
  heroImageUrl: string
  travelDescription: string
  comparisonTable: ComparisonOption[]
  routeFaqs: RouteFaq[]
  /** Optional road tips / stopovers. Omitted sections are skipped in the UI. */
  insights?: RouteInsight[]
  relatedSlugs: string[]
}

export type TransferRouteSeed = Omit<
  TransferRoute,
  "priceEur" | "priceFromLiveQuote"
> & {
  /** Fallback when zone pricing is missing. */
  catalogPriceEur: number
}

export const TRANSFER_CMS_PREFIX = "transfers/" as const

export function transferCmsSlug(routeSlug: string): string {
  return `${TRANSFER_CMS_PREFIX}${routeSlug}`
}

export function routeSlugFromCmsSlug(cmsSlug: string): string | null {
  if (!cmsSlug.startsWith(TRANSFER_CMS_PREFIX)) return null
  const id = cmsSlug.slice(TRANSFER_CMS_PREFIX.length)
  return id || null
}

const ORIGIN = "Tirana International Airport (TIA)"

/** Keyword-rich anchors + URLs for destination ↔ transfer internal linking. */
export const DESTINATION_TRANSFER_LINKS: Record<
  string,
  { transferSlug: string; anchor: string }
> = {
  sarande: {
    transferSlug: "tirana-airport-to-saranda",
    anchor: "book a private transfer from Tirana Airport to Sarandë",
  },
  ksamil: {
    transferSlug: "tirana-airport-to-ksamil",
    anchor: "view fixed driver rates for Tirana to Ksamil",
  },
  vlore: {
    transferSlug: "tirana-airport-to-vlore",
    anchor: "reserve a direct TIA airport taxi to Vlorë",
  },
}

export function transferLinkForDestination(destinationId: string) {
  return DESTINATION_TRANSFER_LINKS[destinationId] ?? null
}

/** Shared high-intent FAQs appended to every seeded transfer route. */
function sharedHighIntentFaqs(destinationLabel: string): RouteFaq[] {
  return [
    {
      question: `Do you cover late-night flights from Tirana Airport to ${destinationLabel}?`,
      answer:
        "Yes. Live flight tracking means your private driver Tirana Airport pickup adjusts for delays—including midnight and early-morning arrivals. Waiting time for tracked flights is included in your fixed taxi rate TIA quote, with no surprise midnight surcharges for standard schedule changes.",
    },
    {
      question: "What currencies can I pay on arrival?",
      answer:
        "This is a cash on arrival transfer. Drivers typically accept euros (€) for the quoted fixed fare. Albanian Lek (ALL) and other major currencies may be accepted depending on the driver—confirm in your booking notes if you prefer ALL. No online deposit is required to reserve.",
    },
    {
      question: "Sedan or minivan—what fits my luggage?",
      answer:
        "Sedans suit most couples with standard suitcases. Choose a minivan when you have large bags, strollers, sports gear, or a family group. Select passenger and luggage counts when you book so we match the vehicle—mention oversized items (golf clubs, surfboards) in the notes.",
    },
    {
      question: "Where is the meet & greet at Tirana Airport (TIA)?",
      answer:
        "After baggage reclaim, exit into the TIA arrivals hall. Your driver waits with a name board for your booking. That meet & greet is included, so you skip the curb scramble for a late night TIA airport taxi.",
    },
  ]
}

const ROUTE_SEEDS: TransferRouteSeed[] = [
  {
    slug: "tirana-airport-to-saranda",
    origin: ORIGIN,
    destinationName: "Sarandë",
    nameVariants: ["Saranda"],
    destinationId: "sarande",
    zoneName: "Sarandë",
    distanceKm: 230,
    duration: {
      minMinutes: 210,
      maxMinutes: 240,
      label: "3.5–4 hrs",
    },
    catalogPriceEur: 55,
    heroImageUrl:
      getDestination("sarande")?.image ??
      "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&q=80&w=1600",
    travelDescription:
      "Book a private driver Tirana Airport to Sarandë (Saranda) with a fixed taxi rate TIA travellers can trust—cash on arrival transfer, free flight tracking, and meet & greet. Ideal if you need a late night TIA airport taxi that continues straight to the Riviera without bus changes.",
    comparisonTable: [
      {
        mode: "Private transfer",
        typicalTime: "3.5–4 hrs",
        changes: "Door to door",
        priceClarity: "Fixed quote",
        highlight: true,
      },
      {
        mode: "Public bus / shared",
        typicalTime: "5–7+ hrs",
        changes: "Often 1–2",
        priceClarity: "Varies by leg",
      },
      {
        mode: "Street taxi (terminal)",
        typicalTime: "3.5–5 hrs",
        changes: "Negotiate at curb",
        priceClarity: "Uncertain / cash only",
      },
    ],
    routeFaqs: [
      {
        question: "How long is Tirana Airport to Sarandë (Saranda) by private car?",
        answer:
          "Most private transfers take about 3.5–4 hours depending on traffic, season, and short comfort stops. Summer weekends toward Saranda / Sarandë on the coast can add time.",
      },
      {
        question: "Is the fare a fixed taxi rate from TIA?",
        answer:
          "Yes. Landed quotes a fixed EUR fare before you travel—no meter surprises. Reserve with €0 deposit and complete a cash on arrival transfer when you meet your driver.",
      },
      {
        question: "Can we stop near Vlorë (Vlora) or Himarë (Himara) on the way?",
        answer:
          "Short comfort or coffee stops are normal on this long route. Mention any must-stop requests (Vlora corridor, Himara / Himarë, Dhërmi / Dhermi viewpoints) when you book.",
      },
      ...sharedHighIntentFaqs("Sarandë (Saranda)"),
    ],
    insights: [
      {
        title: "Road conditions",
        body: "The run south uses Albania’s main highway network before joining coastal roads toward Sarandë / Saranda. An experienced private driver Tirana Airport team is the lowest-stress option after a flight—especially versus a late night TIA airport taxi negotiated at the curb.",
      },
      {
        title: "Recommended stopovers",
        body: "A coffee or stretch stop around Vlorë (Vlora) / the Llogara corridor is common. Some travellers also pause near Himarë (Himara) or Dhërmi (Dhermi) when continuing along the Riviera—ask your driver if you prefer a longer break.",
      },
      {
        title: "Travel tip",
        body: "If you continue to Corfu the next day, Sarandë (Saranda) is the classic overnight base. Share your hotel drop-off when you reserve this cash on arrival transfer.",
      },
    ],
    relatedSlugs: [
      "tirana-airport-to-ksamil",
      "tirana-airport-to-vlore",
    ],
  },
  {
    slug: "tirana-airport-to-ksamil",
    origin: ORIGIN,
    destinationName: "Ksamil",
    nameVariants: ["Ksamili"],
    destinationId: "ksamil",
    zoneName: "Ksamil",
    distanceKm: 240,
    duration: {
      minMinutes: 230,
      maxMinutes: 260,
      label: "~4 hrs",
    },
    catalogPriceEur: 60,
    heroImageUrl:
      getDestination("ksamil")?.image ??
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1600",
    travelDescription:
      "Door-to-door private driver Tirana Airport service to Ksamil (Ksamili)—no vehicle change in Sarandë/Saranda, a fixed taxi rate TIA quote, and a cash on arrival transfer with meet & greet. Built for beach luggage and late night TIA airport taxi arrivals that still need a long Riviera ride.",
    comparisonTable: [
      {
        mode: "Private transfer",
        typicalTime: "~4 hrs",
        changes: "Door to door",
        priceClarity: "Fixed quote",
        highlight: true,
      },
      {
        mode: "Public bus / shared",
        typicalTime: "6–8+ hrs",
        changes: "Usually via Sarandë",
        priceClarity: "Multi-ticket",
      },
      {
        mode: "Street taxi (terminal)",
        typicalTime: "4–5.5 hrs",
        changes: "Negotiate at curb",
        priceClarity: "Uncertain",
      },
    ],
    routeFaqs: [
      {
        question: "Do I need to change cars in Sarandë (Saranda) for Ksamil?",
        answer:
          "No. A Landed private transfer goes straight from TIA to your Ksamil / Ksamili address in one booking—no Saranda taxi hop required.",
      },
      {
        question: "Is this cheaper than improvising a late night TIA airport taxi?",
        answer:
          "For a four-hour Riviera run, a fixed taxi rate TIA quote is usually clearer than curb negotiation after a delayed flight. You also get flight tracking and a name-board meet & greet.",
      },
      {
        question: "What if I have beach luggage for Ksamili?",
        answer:
          "Choose sedan or minivan based on bags and passengers. Mention strollers or sports gear in the booking notes so we size the vehicle correctly.",
      },
      ...sharedHighIntentFaqs("Ksamil (Ksamili)"),
    ],
    insights: [
      {
        title: "Road conditions",
        body: "Same long southern corridor as Sarandë / Saranda, with a short final stretch to the Ksamil (Ksamili) peninsula and island beaches.",
      },
      {
        title: "Travel tip",
        body: "Share your exact villa or hotel pin—Ksamil has narrow access roads and the right drop-off saves time. Pair with a cash on arrival transfer so you are not hunting ATMs at midnight.",
      },
    ],
    relatedSlugs: [
      "tirana-airport-to-saranda",
      "tirana-airport-to-vlore",
    ],
  },
  {
    slug: "tirana-airport-to-vlore",
    origin: ORIGIN,
    destinationName: "Vlorë",
    nameVariants: ["Vlora"],
    destinationId: "vlore",
    zoneName: "Vlorë",
    distanceKm: 145,
    duration: {
      minMinutes: 110,
      maxMinutes: 140,
      label: "~2 hrs",
    },
    catalogPriceEur: 45,
    heroImageUrl:
      getDestination("vlore")?.image ??
      "https://images.unsplash.com/photo-1519046909924-d93b0f86d5b3?auto=format&fit=crop&q=80&w=1600",
    travelDescription:
      "Your gateway to the Albanian Riviera—book a private driver Tirana Airport to Vlorë (Vlora) with a fixed taxi rate TIA quote, flight tracking, and a cash on arrival transfer. A smart alternative to a late night TIA airport taxi when you want a known fare to the coast.",
    comparisonTable: [
      {
        mode: "Private transfer",
        typicalTime: "~2 hrs",
        changes: "Door to door",
        priceClarity: "Fixed quote",
        highlight: true,
      },
      {
        mode: "Public bus / shared",
        typicalTime: "3–4+ hrs",
        changes: "Often 1",
        priceClarity: "Varies",
      },
      {
        mode: "Street taxi (terminal)",
        typicalTime: "2–3 hrs",
        changes: "Negotiate at curb",
        priceClarity: "Uncertain",
      },
    ],
    routeFaqs: [
      {
        question: "How long is Tirana Airport to Vlorë (Vlora)?",
        answer:
          "Most private transfers take about two hours by car, depending on traffic and the exact drop-off in Vlora / Vlorë.",
      },
      {
        question: "Is Vlorë a good base for Himarë, Dhërmi, or Saranda?",
        answer:
          "Yes. Vlorë (Vlora) is the classic gateway south—many travellers overnight here before continuing to Himarë (Himara), Dhërmi (Dhermi), or Sarandë (Saranda).",
      },
      {
        question: "Do I pay online for this fixed taxi rate from TIA?",
        answer:
          "No deposit is required to reserve. Pay cash to your driver on arrival for the confirmed fixed fare—euros are standard for international travellers.",
      },
      ...sharedHighIntentFaqs("Vlorë (Vlora)"),
    ],
    insights: [
      {
        title: "Road conditions",
        body: "A mostly highway run from TIA toward the coast. Straightforward for daily transfer drivers, less so after a late landing if you rely on an ad-hoc late night TIA airport taxi.",
      },
      {
        title: "Travel tip",
        body: "Continuing to Himarë (Himara), Dhërmi (Dhermi), or Sarandë (Saranda)? Tell us—we can quote a same-driver or next-day Riviera leg with the same cash on arrival transfer model.",
      },
    ],
    relatedSlugs: [
      "tirana-airport-to-saranda",
      "tirana-airport-to-ksamil",
    ],
  },
]

const bySlug = new Map(ROUTE_SEEDS.map((route) => [route.slug, route]))

export function isBuiltInTransferSlug(slug: string): boolean {
  return bySlug.has(slug)
}

export function getTransferSeed(slug: string): TransferRouteSeed | null {
  return bySlug.get(slug) ?? null
}

export function listTransferSeeds(): TransferRouteSeed[] {
  return [...ROUTE_SEEDS]
}

/**
 * Resolve a programmatic transfer route by URL slug.
 * Prefers CMS override (`PageContent` transfers/*), then code seed.
 * Live sedan fare comes from `calculatePriceForZone` when the zone exists.
 */
export async function getRouteData(
  slug: string,
): Promise<TransferRoute | null> {
  const { resolveTransferSeed, hydrateTransferRoute } = await import(
    "@/lib/transfers/cms"
  )
  const seed = await resolveTransferSeed(slug)
  if (!seed) return null
  return hydrateTransferRoute(seed)
}

/** Built-in + CMS transfer slugs (CMS-only routes included). */
export async function listTransferRouteSlugs(): Promise<string[]> {
  const { listCmsTransferSlugs } = await import("@/lib/transfers/cms")
  const cms = await listCmsTransferSlugs()
  return [...new Set([...ROUTE_SEEDS.map((r) => r.slug), ...cms])]
}

/** Display label including dual spellings for body/meta copy. */
export function routeDestinationLabel(route: TransferRoute): string {
  if (route.nameVariants.length === 0) return route.destinationName
  return `${route.destinationName} (${route.nameVariants.join(" / ")})`
}

/** Related routes for the grid (excludes current; fills from catalog if needed). */
export async function getRelatedRoutes(
  slug: string,
  limit = 3,
): Promise<TransferRoute[]> {
  const { listCmsTransferSlugs } = await import("@/lib/transfers/cms")
  const current = await getRouteData(slug)
  const preferred = current?.relatedSlugs ?? getTransferSeed(slug)?.relatedSlugs ?? []
  const cmsSlugs = await listCmsTransferSlugs()
  const all = [
    ...new Set([
      ...ROUTE_SEEDS.map((r) => r.slug),
      ...cmsSlugs,
    ]),
  ].filter((s) => s !== slug)
  const ordered = [
    ...preferred.filter((s) => s !== slug && all.includes(s)),
    ...all.filter((s) => !preferred.includes(s)),
  ].slice(0, limit)

  const routes = await Promise.all(ordered.map((s) => getRouteData(s)))
  return routes.filter((r): r is TransferRoute => Boolean(r))
}
