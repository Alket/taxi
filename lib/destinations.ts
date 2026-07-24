export type Destination = {
  id: string
  name: string
  region: string
  description: string
  badge: string
  priceFrom: string
  image: string
  /** Keywords matched against booking addresses for review filtering. */
  reviewKeywords: string[]
}

export const DESTINATIONS: Destination[] = [
  {
    id: "tirana",
    name: "Tirana City Escape",
    region: "Central Albania",
    description:
      "Vibrant capital streets, cafés, and quick airport links for city stays.",
    badge: "Popular",
    priceFrom: "€25",
    image:
      "https://images.unsplash.com/photo-1600093463592-8e77ffe2476e?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Tirana", "TIA"],
  },
  {
    id: "durres",
    name: "Durrës Coast",
    region: "Adriatic Coast",
    description:
      "Historic port city with sandy beaches and Roman ruins minutes from the shore.",
    badge: "Trending",
    priceFrom: "€30",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Durrës", "Durres"],
  },
  {
    id: "vlore",
    name: "Vlorë Riviera",
    region: "Albanian Riviera",
    description:
      "Gateway to the south — turquoise bays, promenades, and sunset views.",
    badge: "Coastal",
    priceFrom: "€45",
    image:
      "https://images.unsplash.com/photo-1519046909924-d93b0f86d5b3?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Vlorë", "Vlore"],
  },
  {
    id: "sarande",
    name: "Sarandë Seaside",
    region: "Southern Coast",
    description:
      "Lively seaside town facing Corfu, with crystal waters and nightlife.",
    badge: "Best Value",
    priceFrom: "€55",
    image:
      "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Sarandë", "Sarande"],
  },
  {
    id: "ksamil",
    name: "Ksamil Islands",
    region: "Butrint National Park",
    description:
      "Iconic turquoise islands and white-sand coves on the Ionian Sea.",
    badge: "Must See",
    priceFrom: "€60",
    image:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Ksamil"],
  },
  {
    id: "berat",
    name: "Berat Heritage",
    region: "UNESCO Heritage",
    description:
      "The city of a thousand windows — Ottoman architecture and hilltop castles.",
    badge: "Culture",
    priceFrom: "€40",
    image:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Berat"],
  },
  {
    id: "shkoder",
    name: "Shkodër Lakeside",
    region: "Northern Albania",
    description:
      "Lake-side charm, cycling routes, and the gateway to the Accursed Mountains.",
    badge: "Adventure",
    priceFrom: "€35",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Shkodër", "Shkoder"],
  },
  {
    id: "theth",
    name: "Theth Wilderness",
    region: "Albanian Alps",
    description:
      "Remote mountain valleys, traditional stone towers, and alpine hiking trails.",
    badge: "Mountains",
    priceFrom: "€70",
    image:
      "https://images.unsplash.com/photo-1464822759844-d150baec0137?auto=format&fit=crop&q=80&w=800",
    reviewKeywords: ["Theth"],
  },
]

export function getDestination(id: string) {
  return DESTINATIONS.find((d) => d.id === id) ?? null
}
