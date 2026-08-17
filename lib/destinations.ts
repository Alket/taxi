export type Destination = {
  id: string
  /** Public URL segment (`/destinations/{slug}`). Defaults to `id`. */
  slug: string
  name: string
  region: string
  description: string
  badge: string
  priceFrom: string
  image: string
  /** Accessibility text from media library when available. */
  imageAlt?: string
  /** Short travel-time label for cards (e.g. "20–25 min"). */
  travelTime: string
  /** Primary SEO keyword shown on cards. */
  primaryKeyword: string
  /** Keywords matched against booking addresses for review filtering. */
  reviewKeywords: string[]
}

export const DESTINATIONS: Destination[] = [
  {
    id: "tirana",
    slug: "tirana",
    name: "Tirana City Escape",
    region: "Central Albania",
    description:
      "Vibrant capital streets, cafés, and a quick private driver Tirana Airport link for city stays—fixed taxi rate TIA pricing with cash on arrival transfer options.",
    badge: "Popular",
    priceFrom: "€25",
    image:
      "https://images.unsplash.com/photo-1600093463592-8e77ffe2476e?auto=format&fit=crop&q=80&w=800",
    travelTime: "20–25 min",
    primaryKeyword: "Tirana Airport Transfer",
    reviewKeywords: ["Tirana", "TIA"],
  },
  {
    id: "durres",
    slug: "durres",
    name: "Durrës Coast",
    region: "Adriatic Coast",
    description:
      "Historic port city Durrës (Durres) with sandy beaches and Roman ruins—easy fixed-price airport transfer from TIA for cruise and beach arrivals.",
    badge: "Trending",
    priceFrom: "€30",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800",
    travelTime: "35–40 min",
    primaryKeyword: "Durrës Airport Transfer",
    reviewKeywords: ["Durrës", "Durres"],
  },
  {
    id: "vlore",
    slug: "vlore",
    name: "Vlorë Riviera",
    region: "Albanian Riviera",
    description:
      "Gateway to the south—Vlorë (Vlora) turquoise bays and promenades. Book a private driver Tirana Airport ride with a fixed taxi rate TIA travellers trust.",
    badge: "Coastal",
    priceFrom: "€45",
    image:
      "https://images.unsplash.com/photo-1519046909924-d93b0f86d5b3?auto=format&fit=crop&q=80&w=800",
    travelTime: "~2 hrs",
    primaryKeyword: "Vlorë Airport Transfer",
    reviewKeywords: ["Vlorë", "Vlore", "Vlora"],
  },
  {
    id: "sarande",
    slug: "sarande",
    name: "Sarandë Seaside",
    region: "Southern Coast",
    description:
      "Lively Sarandë (Saranda) facing Corfu—crystal waters, nightlife, and a popular cash on arrival transfer corridor from Tirana Airport.",
    badge: "Best Value",
    priceFrom: "€55",
    image:
      "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&q=80&w=800",
    travelTime: "3.5–4 hrs",
    primaryKeyword: "Sarandë Airport Transfer",
    reviewKeywords: ["Sarandë", "Sarande", "Saranda"],
  },
  {
    id: "ksamil",
    slug: "ksamil",
    name: "Ksamil Islands",
    region: "Butrint National Park",
    description:
      "Iconic Ksamil (Ksamili) turquoise islands and white-sand coves—door-to-door private transfer from TIA without changing cars in Saranda.",
    badge: "Must See",
    priceFrom: "€60",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800",
    travelTime: "~4 hrs",
    primaryKeyword: "Ksamil Airport Transfer",
    reviewKeywords: ["Ksamil", "Ksamili"],
  },
  {
    id: "berat",
    slug: "berat",
    name: "Berat Heritage",
    region: "UNESCO Heritage",
    description:
      "Berat (Berati), the city of a thousand windows—Ottoman architecture and hilltop castles reached by fixed-price airport transfer from TIA.",
    badge: "Culture",
    priceFrom: "€40",
    image:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800",
    travelTime: "~2 hrs",
    primaryKeyword: "Berat Airport Transfer",
    reviewKeywords: ["Berat", "Berati"],
  },
  {
    id: "shkoder",
    slug: "shkoder",
    name: "Shkodër Lakeside",
    region: "Northern Albania",
    description:
      "Shkodër (Shkodra) lake-side charm and the gateway to the Accursed Mountains—reliable private driver Tirana Airport transfers north.",
    badge: "Adventure",
    priceFrom: "€35",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=800",
    travelTime: "~1.5 hrs",
    primaryKeyword: "Shkodër Airport Transfer",
    reviewKeywords: ["Shkodër", "Shkoder", "Shkodra"],
  },
  {
    id: "theth",
    slug: "theth",
    name: "Theth Wilderness",
    region: "Albanian Alps",
    description:
      "Remote mountain valleys, traditional stone towers, and alpine hiking trails—best reached with a driver who knows the mountain road from TIA.",
    badge: "Mountains",
    priceFrom: "€70",
    image:
      "https://images.unsplash.com/photo-1464822759844-d150baec0137?auto=format&fit=crop&q=80&w=800",
    travelTime: "3–3.5 hrs",
    primaryKeyword: "Theth Airport Transfer",
    reviewKeywords: ["Theth"],
  },
]

export function getDestination(id: string) {
  return DESTINATIONS.find((d) => d.id === id) ?? null
}

export function slugifyDestinationId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function normalizePlaceName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Match a booking service zone name to a marketing destination (CMS image source). */
export function matchDestinationForZoneName(
  zoneName: string,
): Destination | null {
  const normalized = normalizePlaceName(zoneName)
  if (!normalized) return null

  for (const dest of DESTINATIONS) {
    const id = normalizePlaceName(dest.id)
    if (normalized === id || normalized.includes(id) || id.includes(normalized)) {
      return dest
    }
    for (const keyword of dest.reviewKeywords) {
      const kw = normalizePlaceName(keyword)
      if (!kw) continue
      if (
        normalized === kw ||
        normalized.includes(kw) ||
        kw.includes(normalized.split(" ")[0] ?? "")
      ) {
        return dest
      }
    }
  }
  return null
}
