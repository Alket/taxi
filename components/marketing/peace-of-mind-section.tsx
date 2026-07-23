import {
  CircleDollarSignIcon,
  ClockIcon,
  MousePointerClickIcon,
  PlaneIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

type Feature = {
  title: string
  icon: LucideIcon
  iconClassName: string
}

const FEATURES: Feature[] = [
  {
    title: "Meet-and-Greet",
    icon: UserRoundIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    title: "Flight Tracking",
    icon: PlaneIcon,
    iconClassName: "bg-[oklch(0.94_0.04_230)] text-[oklch(0.45_0.12_240)]",
  },
  {
    title: "Easy Booking",
    icon: MousePointerClickIcon,
    iconClassName: "bg-[oklch(0.96_0.06_70)] text-[oklch(0.55_0.14_70)]",
  },
  {
    title: "Reliable Chauffeurs",
    icon: ShieldCheckIcon,
    iconClassName: "bg-[oklch(0.95_0.05_300)] text-[oklch(0.48_0.14_300)]",
  },
  {
    title: "Fixed Prices",
    icon: CircleDollarSignIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    title: "Clear Cancellation Terms",
    icon: ClockIcon,
    iconClassName: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.45_0.14_250)]",
  },
]

export function PeaceOfMindSection() {
  return (
    <section className={cn(MARKETING_SECTION, "overflow-hidden")}>
      <MarketingContainer>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-accent/70 p-8 sm:p-12 lg:p-16">
          <div className="mb-12 max-w-2xl">
            <span className="mb-3 block text-xs font-extrabold tracking-widest text-primary uppercase">
              Absolute Peace of Mind
            </span>
            <h2 className={MARKETING_SECTION_TITLE}>
              Why Book with Albania Transfers
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, icon: Icon, iconClassName }) => (
              <div
                key={title}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md sm:p-8"
              >
                <h3 className="text-lg font-extrabold text-brand transition-colors group-hover:text-primary sm:text-xl">
                  {title}
                </h3>
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl",
                    iconClassName,
                  )}
                >
                  <Icon className="size-6" strokeWidth={1.8} aria-hidden />
                </div>
              </div>
            ))}
          </div>
        </div>
      </MarketingContainer>
    </section>
  )
}
