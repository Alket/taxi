import { getBlogAuthor } from "@/lib/blog/authors"
import type {
  BlogCategoryId,
  BlogFilterId,
  BlogPost,
} from "@/lib/blog/types"
import { DESTINATIONS, type Destination } from "@/lib/destinations"

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "is-there-uber-in-albania-2026",
    title: "Is There Uber in Albania in 2026?",
    seoTitle: "Is There Uber in Albania 2026? | TIA Transfers",
    seoDescription:
      "Uber is not reliably available in Albania. See how fixed-price Tirana Airport transfers with €0 deposit compare for TIA arrivals.",
    excerpt:
      "Planning a Tirana Airport arrival? Here is the clear 2026 answer on Uber, Bolt, taxis, and why pre-booked private transfers win for fixed pricing and cash on arrival.",
    category: "airport-transport",
    publishedAt: "2026-03-12",
    updatedAt: "2026-08-01",
    readTimeMinutes: 7,
    authorId: "landed-team",
    featured: true,
    heroImage: {
      src: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=1600",
      alt: "Private car waiting outside an airport terminal for arriving passengers",
      width: 1600,
      height: 900,
    },
    quickTakeaway:
      "Uber is not a dependable option at Tirana International Airport (TIA) in 2026. For fixed fares, meet & greet, and cash payment on arrival with €0 deposit, a pre-booked private transfer is the most predictable choice.",
    relatedDestinationIds: ["tirana", "durres", "sarande"],
    blocks: [
      {
        type: "paragraph",
        text: "Travellers searching “Uber Albania” or “Uber Tirana Airport” usually want one thing: a simple ride from TIA without surge pricing or cash confusion. This guide explains what actually works in 2026.",
      },
      { type: "h2", text: "Does Uber work in Albania?" },
      {
        type: "paragraph",
        text: "As of 2026, Uber is not a reliable nationwide ride-hailing service in Albania. Coverage that exists in other European capitals does not map cleanly onto Tirana Airport arrivals, late-night landings, or long coastal transfers.",
      },
      {
        type: "callout",
        title: "Quick reality check",
        text: "Do not plan your TIA exit around opening an app after landing. Have a confirmed driver waiting—especially with luggage, kids, or a late flight.",
      },
      { type: "h2", text: "What travellers use instead at TIA" },
      {
        type: "ul",
        items: [
          "Pre-booked private airport transfers with a fixed price quoted before you fly",
          "Official airport taxis (metered or negotiated—prices can vary by time and demand)",
          "Local ride apps where available in the city (coverage and airport pickup rules vary)",
          "Hotel or apartment shuttles (often limited to Tirana city and set schedules)",
        ],
      },
      { type: "h2", text: "Fixed-price transfer vs guessing at the curb" },
      {
        type: "table",
        caption: "Comparing common Tirana Airport options",
        headers: ["Option", "Price clarity", "Meet & greet", "Pay on arrival"],
        rows: [
          ["Uber / similar apps", "Unreliable at TIA", "Rare", "App-dependent"],
          ["Airport taxi queue", "Often negotiated", "No", "Usually cash/card"],
          ["Landed private transfer", "Fixed before booking", "Yes", "Cash, €0 deposit"],
        ],
      },
      { type: "mid_cta" },
      { type: "h2", text: "Why fixed pricing matters for Albania routes" },
      {
        type: "paragraph",
        text: "Routes from Tirana Airport to the Riviera (Sarandë, Ksamil, Vlorë) are long. Without a locked fare, you absorb uncertainty around night arrivals, traffic, and driver availability. A private transfer quotes the total up front.",
      },
      { type: "h3", text: "Cash on arrival, zero deposit" },
      {
        type: "paragraph",
        text: "Landed is built for visitors who prefer not to prepay online: reserve your driver, get met at arrivals, and pay cash when you land—€0 deposit required to hold the booking.",
      },
      { type: "h2", text: "Practical tip for your next landing" },
      {
        type: "ol",
        items: [
          "Share your flight number so the driver can track delays",
          "Confirm the destination address or hotel name in advance",
          "Skip curb negotiations—walk out to your named driver",
          "Pay the agreed fixed fare in cash on arrival",
        ],
      },
    ],
    faq: [
      {
        question: "Is Uber available at Tirana Airport?",
        answer:
          "You should not rely on Uber for TIA pickups in 2026. Pre-book a private transfer if you need a confirmed driver and fixed price.",
      },
      {
        question: "Can I pay cash for an airport transfer?",
        answer:
          "Yes. Landed transfers are designed for cash payment on arrival with €0 deposit when you reserve.",
      },
      {
        question: "What if my flight is delayed?",
        answer:
          "Include your flight number when booking. Drivers monitor arrivals so meet & greet still works when planes run late.",
      },
    ],
  },
  {
    slug: "tirana-airport-arrivals-meet-and-greet",
    title: "Tirana Airport Arrivals: Meet & Greet Tips for TIA",
    seoTitle: "TIA Arrivals Guide: Meet & Greet Tips",
    seoDescription:
      "How Tirana Airport arrivals work: terminals, bags, meet & greet points, and booking a fixed-price driver with cash on arrival.",
    excerpt:
      "First time through Tirana International Airport? Learn the arrivals flow, where drivers wait, and how meet & greet transfers remove the stress.",
    category: "airport-transport",
    publishedAt: "2026-02-18",
    updatedAt: "2026-07-20",
    readTimeMinutes: 6,
    authorId: "landed-team",
    heroImage: {
      src: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=1600",
      alt: "Airplane wing above clouds on approach to landing",
      width: 1600,
      height: 900,
    },
    quickTakeaway:
      "After landing at TIA, collect bags, exit to arrivals, and look for your named driver. A meet & greet transfer with flight tracking beats improvising transport after a long flight.",
    relatedDestinationIds: ["tirana", "durres", "berat"],
    blocks: [
      {
        type: "paragraph",
        text: "Tirana International Airport (TIA / Nënë Tereza) is compact compared with mega-hubs, but jet lag plus luggage still makes the first 20 minutes decisive. Here is how arrivals usually unfold.",
      },
      { type: "h2", text: "From gate to arrivals hall" },
      {
        type: "ol",
        items: [
          "Disembark and follow signs for baggage reclaim / Arrivals",
          "Clear passport control if required for your nationality",
          "Collect checked bags",
          "Exit into the public arrivals area where drivers wait with name signs",
        ],
      },
      { type: "h2", text: "Why meet & greet helps at TIA" },
      {
        type: "paragraph",
        text: "Your driver monitors the flight, adjusts for delays, and waits in the agreed spot. You are not hunting for taxis or arguing about destination pricing while tired.",
      },
      {
        type: "callout",
        title: "Pro tip",
        text: "Save your booking confirmation and driver contact offline. Airport Wi‑Fi can be slow right after landing.",
      },
      { type: "mid_cta" },
      { type: "h2", text: "Fixed fare from the moment you book" },
      {
        type: "paragraph",
        text: "Whether you are heading into Tirana city or continuing to the coast, a private transfer locks the price before you fly. Pay cash on arrival—no deposit needed to reserve with Landed.",
      },
      { type: "h3", text: "Night and early-morning landings" },
      {
        type: "paragraph",
        text: "Public options thin out overnight. A pre-booked car is often the only calm exit after red-eye flights.",
      },
    ],
    faq: [
      {
        question: "Where does the driver meet me at TIA?",
        answer:
          "In the public arrivals area after baggage claim, typically with a name sign. Exact instructions are in your booking confirmation.",
      },
      {
        question: "How long will the driver wait if I am delayed?",
        answer:
          "With flight tracking, waiting time is built around your actual landing. Confirm buffer details when you book if you expect long immigration queues.",
      },
      {
        question: "Do I need to pay online?",
        answer:
          "No. Landed lets you reserve with €0 deposit and pay cash when you meet your driver.",
      },
    ],
  },
  {
    slug: "tirana-airport-to-saranda-transfer-guide",
    title: "Tirana Airport to Saranda: Transfer Guide",
    seoTitle: "TIA to Saranda Transfer Guide 2026",
    seoDescription:
      "Drive time, stops, and fixed-price tips for Tirana Airport to Sarandë. Skip uncertain buses—book a private transfer with cash on arrival.",
    excerpt:
      "The Albania Riviera run from TIA to Sarandë is scenic and long. Here is travel time, what to expect, and how a fixed-price private transfer works.",
    category: "destinations-routes",
    publishedAt: "2026-01-28",
    updatedAt: "2026-06-15",
    readTimeMinutes: 8,
    authorId: "landed-team",
    heroImage: {
      src: "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&q=80&w=1600",
      alt: "Turquoise Adriatic coastline near Sarandë in southern Albania",
      width: 1600,
      height: 900,
    },
    quickTakeaway:
      "Tirana Airport to Sarandë typically takes about 3.5–4 hours by private car. A fixed-price transfer avoids multi-leg buses and curb negotiations after landing.",
    relatedDestinationIds: ["sarande", "ksamil", "vlore"],
    blocks: [
      {
        type: "paragraph",
        text: "Sarandë (Saranda) is one of Albania’s most popular seaside bases—Corfu views, promenade energy, and a gateway to Ksamil and Butrint. Getting there from TIA is a proper road trip.",
      },
      { type: "h2", text: "How long is the transfer?" },
      {
        type: "paragraph",
        text: "Most private transfers take roughly 3.5–4 hours depending on traffic, season, and short comfort stops. Summer weekends and coastal bottlenecks can add time.",
      },
      { type: "h2", text: "Private transfer vs bus connections" },
      {
        type: "table",
        caption: "TIA → Sarandë options at a glance",
        headers: ["Mode", "Typical time", "Changes", "Price clarity"],
        rows: [
          ["Private transfer", "3.5–4 hrs", "Door to door", "Fixed quote"],
          ["Bus / shared", "5–7+ hrs", "Often 1–2", "Varies by leg"],
          ["Rental car", "3.5–5 hrs", "Self-drive", "Fuel + tolls + stress"],
        ],
      },
      {
        type: "callout",
        title: "Families & late flights",
        text: "If you land after dinner with kids or lots of bags, door-to-door is usually worth more than saving a few euros on shared transport.",
      },
      { type: "mid_cta" },
      { type: "h2", text: "What a Landed transfer includes" },
      {
        type: "ul",
        items: [
          "Flight monitoring and meet & greet at TIA",
          "Fixed fare agreed before you travel",
          "Comfortable vehicle sized for your passengers and luggage",
          "Cash payment on arrival with €0 deposit to book",
        ],
      },
      { type: "h3", text: "Continuing to Ksamil" },
      {
        type: "paragraph",
        text: "Many travellers sleep in Sarandë and day-trip to Ksamil. You can also book a transfer that drops you straight at your Ksamil stay—ask when you reserve.",
      },
    ],
    faq: [
      {
        question: "Is the road from Tirana Airport to Saranda safe?",
        answer:
          "It is a standard long-distance Albanian highway and coastal route used daily by professionals. An experienced transfer driver is the lowest-stress option for visitors.",
      },
      {
        question: "Can we stop for a break?",
        answer:
          "Short comfort or coffee stops are normal on this route. Mention any must-stop requests when booking.",
      },
      {
        question: "How do I get a fixed price?",
        answer:
          "Use the Landed booking form with Tirana Airport and Sarandë as endpoints. Your fare is confirmed before you fly.",
      },
    ],
  },
  {
    slug: "cash-vs-apps-airport-rides-albania",
    title: "Cash vs Apps for Airport Rides in Albania",
    seoTitle: "Cash vs Apps: Albania Airport Rides",
    seoDescription:
      "Should you pay airport rides in Albania by app or cash? Compare TIA options and why €0-deposit cash transfers suit many visitors.",
    excerpt:
      "Card machines fail, apps lack coverage, and cash is still king on many Albanian routes. Here is how to plan payment for your airport ride.",
    category: "local-tips",
    publishedAt: "2026-04-02",
    updatedAt: "2026-07-01",
    readTimeMinutes: 5,
    authorId: "landed-team",
    heroImage: {
      src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1600",
      alt: "Traveller holding euro banknotes for a cash payment",
      width: 1600,
      height: 900,
    },
    quickTakeaway:
      "Carry euros for airport transfers in Albania. App-only plans break down when coverage fails; Landed’s cash-on-arrival model with €0 deposit keeps pickup simple.",
    relatedDestinationIds: ["tirana", "vlore", "shkoder"],
    blocks: [
      {
        type: "paragraph",
        text: "Payment friction is one of the top surprises for first-time visitors. Between patchy card acceptance and incomplete ride-app coverage, cash planning still matters—especially at TIA.",
      },
      { type: "h2", text: "Why apps alone are risky at the airport" },
      {
        type: "ul",
        items: [
          "Ride-hail coverage may not match your arrival time",
          "International cards can trigger bank declines abroad",
          "Roaming data hiccups delay opening an app after landing",
        ],
      },
      { type: "h2", text: "Cash-on-arrival transfers" },
      {
        type: "paragraph",
        text: "A reserved private transfer quotes your fare in advance. You meet the driver and pay cash—no deposit required to book with Landed—so you are not stuck negotiating after a long flight.",
      },
      { type: "mid_cta" },
      { type: "h3", text: "How much cash to bring" },
      {
        type: "paragraph",
        text: "Bring enough euros to cover your quoted transfer plus a small buffer for water or snacks. ATMs exist in Tirana, but relying on one immediately after landing adds delay.",
      },
      { type: "h2", text: "Local travel tip" },
      {
        type: "callout",
        text: "Keep small bills when possible. Drivers appreciate exact or near-exact change on fixed fares.",
      },
    ],
    faq: [
      {
        question: "Do Landed drivers accept card?",
        answer:
          "Landed’s standard promise is cash on arrival with €0 deposit. Ask support before travel if you need an alternative arrangement.",
      },
      {
        question: "Are euros accepted?",
        answer:
          "Yes—fares are typically quoted in euros for airport transfers aimed at international travellers.",
      },
      {
        question: "Should I tip?",
        answer:
          "Tipping is appreciated but not mandatory. Rounding up for excellent service is common.",
      },
    ],
  },
  {
    slug: "fixed-price-transfers-vs-taxis-tia",
    title: "Fixed-Price Transfers vs Taxis at Tirana Airport",
    seoTitle: "Fixed Price vs Taxi at Tirana Airport",
    seoDescription:
      "Compare TIA taxi queues with fixed-price private transfers: cost clarity, waiting, luggage, and cash payment on arrival.",
    excerpt:
      "Airport taxis are easy to spot—but fixed-price private transfers remove negotiation and surprise markups. See which fits your trip.",
    category: "airport-transport",
    publishedAt: "2026-05-10",
    updatedAt: "2026-08-05",
    readTimeMinutes: 6,
    authorId: "landed-team",
    heroImage: {
      src: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=1600",
      alt: "Black private transfer car parked ready for airport passengers",
      width: 1600,
      height: 900,
    },
    quickTakeaway:
      "Taxis work for short Tirana hops if you accept variable pricing. For longer routes—or peace of mind—book a fixed-price transfer with meet & greet and cash on arrival.",
    relatedDestinationIds: ["tirana", "berat", "durres"],
    blocks: [
      {
        type: "paragraph",
        text: "Both taxis and private transfers can get you from TIA to your hotel. The difference is predictability: knowing the fare, the vehicle size, and that someone is already waiting.",
      },
      { type: "h2", text: "When a taxi queue is fine" },
      {
        type: "ul",
        items: [
          "Short hop into central Tirana with light bags",
          "You are comfortable confirming the price before departure",
          "Daytime arrivals with plenty of vehicles available",
        ],
      },
      { type: "h2", text: "When a fixed-price transfer wins" },
      {
        type: "ol",
        items: [
          "Coastal or mountain destinations with multi-hour drives",
          "Family groups needing a larger vehicle",
          "Late-night landings when queues and rates feel uncertain",
          "Anyone who wants flight tracking and a name-board greeting",
        ],
      },
      {
        type: "table",
        caption: "Taxi queue vs Landed private transfer",
        headers: ["Factor", "Airport taxi", "Fixed private transfer"],
        rows: [
          ["Fare", "Often discussed on the spot", "Locked when you book"],
          ["Pickup", "Queue / curb", "Meet & greet"],
          ["Deposit", "N/A", "€0 with Landed"],
          ["Payment", "Cash/card varies", "Cash on arrival"],
        ],
      },
      { type: "mid_cta" },
      { type: "h2", text: "Bottom line for TIA travellers" },
      {
        type: "paragraph",
        text: "If your priority is a known price and a driver who already has your flight details, reserve a private transfer. Calculate your fare before you fly and pay when you land.",
      },
    ],
    faq: [
      {
        question: "Are private transfers more expensive than taxis?",
        answer:
          "For short city rides, taxis can look cheaper. On longer Albania routes, a fixed quote often matches or beats stressful multi-leg alternatives—and removes surprise pricing.",
      },
      {
        question: "Can I book for a group?",
        answer:
          "Yes. Choose passenger and luggage counts when booking so the vehicle fits everyone comfortably.",
      },
      {
        question: "Is there a deposit?",
        answer:
          "Landed bookings are designed around €0 deposit with cash payment on arrival.",
      },
    ],
  },
]

export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getPostBySlug(slug: string): BlogPost | null {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null
}

export function getFeaturedPost(): BlogPost {
  return (
    BLOG_POSTS.find((post) => post.featured) ??
    getAllPosts()[0] ??
    BLOG_POSTS[0]
  )
}

export function getPostsByCategory(filter: BlogFilterId): BlogPost[] {
  const posts = getAllPosts()
  if (filter === "all") return posts
  return posts.filter((post) => post.category === filter)
}

export function getArchivePosts(filter: BlogFilterId): {
  featured: BlogPost
  rest: BlogPost[]
} {
  const result = archivePostsFromList(getAllPosts(), filter)
  if (!result.featured) {
    throw new Error("No blog posts available")
  }
  return { featured: result.featured, rest: result.rest }
}

/** Build archive featured + rest from a CMS (or static) post list. */
export function archivePostsFromList(
  posts: BlogPost[],
  filter: BlogFilterId,
): {
  featured: BlogPost | null
  rest: BlogPost[]
} {
  const sorted = [...posts].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
  const filtered =
    filter === "all"
      ? sorted
      : sorted.filter((post) => post.category === filter)
  const globalFeatured =
    sorted.find((post) => post.featured) ?? sorted[0] ?? null

  if (!globalFeatured) {
    return { featured: null, rest: [] }
  }

  if (filter === "all" || globalFeatured.category === filter) {
    return {
      featured: globalFeatured,
      rest: filtered.filter((post) => post.slug !== globalFeatured.slug),
    }
  }

  const [featured, ...rest] = filtered
  return {
    featured: featured ?? globalFeatured,
    rest,
  }
}

/** Map post related IDs onto destination cards (pass CMS cards for real images). */
export function getRelatedDestinations(
  post: BlogPost,
  destinations: Destination[] = DESTINATIONS,
): Destination[] {
  return post.relatedDestinationIds
    .map((id) => destinations.find((d) => d.id === id || d.slug === id))
    .filter((d): d is Destination => Boolean(d))
}

export function getPostAuthor(post: BlogPost) {
  return getBlogAuthor(post.authorId)
}

export function isBlogCategoryId(value: string): value is BlogCategoryId {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value !== "all"
}

export function parseBlogFilter(value: string | null | undefined): BlogFilterId {
  if (!value || value === "all") return "all"
  if (isBlogCategoryId(value)) return value
  return "all"
}

export function formatBlogDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}
