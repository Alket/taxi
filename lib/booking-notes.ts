export type BookingNoteTone = "default" | "accent" | "warning" | "muted"

export type BookingNoteItem = {
  id: string
  label: string
  detail?: string
  tone: BookingNoteTone
}

const AWAITING_DEPOSIT_NOTE =
  /source:\s*public booking\s*[·•-]?\s*awaiting deposit\s*\(unpaid pending checkout\)\.?/i

const KNOWN_NOTES: {
  match: RegExp
  id: string
  label: string
  detail?: string | ((match: RegExpMatchArray) => string | undefined)
  tone: BookingNoteTone
}[] = [
  {
    match: /meet\s*&\s*greet\s*requested\.?/i,
    id: "meet-and-greet",
    label: "Meet & greet",
    detail: "Requested",
    tone: "accent",
  },
  {
    match: AWAITING_DEPOSIT_NOTE,
    id: "public-pending",
    label: "Public booking",
    detail: "Awaiting deposit",
    tone: "warning",
  },
  {
    match: /source:\s*public booking\s*[·•-]?\s*paid in full\.?/i,
    id: "public-paid-full",
    label: "Public booking",
    detail: "Paid in full",
    tone: "muted",
  },
  {
    match: /source:\s*public booking\s*[·•-]?\s*deposit paid\.?/i,
    id: "public-deposit-paid",
    label: "Public booking",
    detail: "Deposit paid",
    tone: "muted",
  },
  {
    match: /source:\s*public booking\s*[·•-]?\s*cash on arrival\.?/i,
    id: "public-cash",
    label: "Public booking",
    detail: "Cash on arrival",
    tone: "muted",
  },
  {
    match: /source:\s*public booking\.?/i,
    id: "public-source",
    label: "Public booking",
    tone: "muted",
  },
  {
    match: /payment method:\s*cash on arrival(?:\s*\(pay driver\))?\.?/i,
    id: "cash-on-arrival",
    label: "Cash on arrival",
    detail: "Pay driver at pickup",
    tone: "default",
  },
  {
    match: /customer opted out of whatsapp updates\.?/i,
    id: "whatsapp-opt-out",
    label: "WhatsApp",
    detail: "Opted out of updates",
    tone: "muted",
  },
  {
    match:
      /driver notes:\s*(.+?)(?=\s+(?:Meet\s*&\s*greet|Source:|Payment method:|Customer opted|Child seats:|Marked paid)|$)/i,
    id: "driver-notes",
    label: "Driver notes",
    detail: (match) => match[1]?.trim().replace(/\.$/, ""),
    tone: "accent",
  },
  {
    match: /child seats:\s*(.+?)\.?$/i,
    id: "child-seats",
    label: "Child seats",
    detail: (match) => match[1]?.trim().replace(/\.$/, ""),
    tone: "default",
  },
]

/**
 * Replace the unpaid public-checkout stamp after payment or cash confirmation.
 */
export function markPublicBookingPaid(
  notes: string | null | undefined,
  outcome: "deposit" | "full" | "cash",
): string | undefined {
  if (!notes?.trim()) return notes ?? undefined

  if (!AWAITING_DEPOSIT_NOTE.test(notes)) return notes

  const replacement =
    outcome === "full"
      ? "Source: public booking · paid in full."
      : outcome === "cash"
        ? "Source: public booking · cash on arrival."
        : "Source: public booking · deposit paid."

  return notes
    .replace(AWAITING_DEPOSIT_NOTE, replacement)
    .replace(/\s+/g, " ")
    .trim()
}

/** Split free-text booking notes into labeled items for admin UI. */
export function parseBookingNotes(
  notes: string | null | undefined,
  opts?: { paymentStatus?: string },
): BookingNoteItem[] {
  if (!notes?.trim()) return []

  let remaining = notes.trim()
  const items: BookingNoteItem[] = []
  const paid =
    opts?.paymentStatus === "deposit_paid" ||
    opts?.paymentStatus === "fully_paid" ||
    opts?.paymentStatus === "paid"

  for (const rule of KNOWN_NOTES) {
    const match = remaining.match(rule.match)
    if (!match) continue

    // Stale checkout stamp: payment already succeeded but note wasn't rewritten.
    if (rule.id === "public-pending" && paid) {
      items.push({
        id: "public-source",
        label: "Public booking",
        detail:
          opts?.paymentStatus === "fully_paid" || opts?.paymentStatus === "paid"
            ? "Paid in full"
            : "Deposit paid",
        tone: "muted",
      })
      remaining = remaining.replace(match[0], " ").replace(/\s+/g, " ").trim()
      continue
    }

    const detail =
      typeof rule.detail === "function" ? rule.detail(match) : rule.detail

    items.push({
      id: rule.id,
      label: rule.label,
      detail,
      tone: rule.tone,
    })

    remaining = remaining.replace(match[0], " ").replace(/\s+/g, " ").trim()
  }

  // Leftover free text (custom admin notes, etc.)
  const leftovers = remaining
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  for (const [index, part] of leftovers.entries()) {
    items.push({
      id: `note-${index}`,
      label: "Note",
      detail: part.replace(/\.$/, ""),
      tone: "warning",
    })
  }

  return items
}
