import {
  CircleDollarSignIcon,
  ClockIcon,
  HeadsetIcon,
  HeartHandshakeIcon,
  MapPinnedIcon,
  MousePointerClickIcon,
  PlaneIcon,
  ShieldCheckIcon,
  StarIcon,
  ThumbsUpIcon,
  UserRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export const MARKETING_ICON_IDS = [
  "headset",
  "wallet",
  "shield",
  "plane",
  "user",
  "click",
  "dollar",
  "clock",
  "star",
  "map",
  "thumbs-up",
  "handshake",
] as const

export type MarketingIconId = (typeof MARKETING_ICON_IDS)[number]

type MarketingIconDef = {
  id: MarketingIconId
  label: string
  icon: LucideIcon
  iconClassName: string
}

export const MARKETING_ICONS: MarketingIconDef[] = [
  {
    id: "headset",
    label: "Headset",
    icon: HeadsetIcon,
    iconClassName: "bg-[oklch(0.95_0.05_15)] text-[oklch(0.55_0.2_15)]",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: WalletIcon,
    iconClassName: "bg-[oklch(0.96_0.06_70)] text-[oklch(0.65_0.18_70)]",
  },
  {
    id: "shield",
    label: "Shield",
    icon: ShieldCheckIcon,
    iconClassName: "bg-[oklch(0.95_0.06_150)] text-[oklch(0.55_0.18_150)]",
  },
  {
    id: "plane",
    label: "Plane",
    icon: PlaneIcon,
    iconClassName: "bg-[oklch(0.94_0.04_230)] text-[oklch(0.45_0.12_240)]",
  },
  {
    id: "user",
    label: "User",
    icon: UserRoundIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    id: "click",
    label: "Click",
    icon: MousePointerClickIcon,
    iconClassName: "bg-[oklch(0.96_0.06_70)] text-[oklch(0.55_0.14_70)]",
  },
  {
    id: "dollar",
    label: "Dollar",
    icon: CircleDollarSignIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    id: "clock",
    label: "Clock",
    icon: ClockIcon,
    iconClassName: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.45_0.14_250)]",
  },
  {
    id: "star",
    label: "Star",
    icon: StarIcon,
    iconClassName: "bg-[oklch(0.96_0.08_90)] text-[oklch(0.6_0.16_80)]",
  },
  {
    id: "map",
    label: "Map pin",
    icon: MapPinnedIcon,
    iconClassName: "bg-[oklch(0.94_0.05_200)] text-[oklch(0.48_0.12_220)]",
  },
  {
    id: "thumbs-up",
    label: "Thumbs up",
    icon: ThumbsUpIcon,
    iconClassName: "bg-[oklch(0.95_0.05_145)] text-[oklch(0.5_0.14_145)]",
  },
  {
    id: "handshake",
    label: "Handshake",
    icon: HeartHandshakeIcon,
    iconClassName: "bg-[oklch(0.95_0.05_300)] text-[oklch(0.48_0.14_300)]",
  },
]

const BY_ID = new Map(MARKETING_ICONS.map((item) => [item.id, item]))

/** Custom uploaded SVG/image path or absolute URL. */
export function isCustomMarketingIcon(
  value: string | undefined | null,
): value is string {
  if (!value) return false
  return (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  )
}

export function getMarketingIcon(
  id: string | undefined | null,
  fallbackIndex = 0,
): MarketingIconDef {
  if (id && BY_ID.has(id as MarketingIconId)) {
    return BY_ID.get(id as MarketingIconId)!
  }
  return MARKETING_ICONS[fallbackIndex % MARKETING_ICONS.length]!
}

export const CUSTOM_ICON_CLASSNAME =
  "bg-[oklch(0.96_0.02_240)] text-brand"

export const MARKETING_ICON_SELECT_ITEMS = MARKETING_ICONS.map((item) => ({
  value: item.id,
  label: item.label,
}))
