import {
  HeadsetIcon,
  ShieldCheckIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

type WhyBookFeature = {
  title: string
  description: string
  icon: LucideIcon
  iconClassName: string
}

const FEATURES: WhyBookFeature[] = [
  {
    title: "24/7 Help Center",
    description:
      "No matter the time zone, we're always here to assist you and answer your questions.",
    icon: HeadsetIcon,
    iconClassName:
      "bg-[oklch(0.95_0.05_15)] text-[oklch(0.55_0.2_15)]",
  },
  {
    title: "Best Price Guarantee",
    description:
      "Find a lower price? We'll match it or refund the difference, hassle-free.",
    icon: WalletIcon,
    iconClassName:
      "bg-[oklch(0.96_0.06_70)] text-[oklch(0.65_0.18_70)]",
  },
  {
    title: "Quality & Reliability",
    description:
      "Book with confidence knowing our services meet the highest standards of safety and trust.",
    icon: ShieldCheckIcon,
    iconClassName:
      "bg-[oklch(0.95_0.06_150)] text-[oklch(0.55_0.18_150)]",
  },
]

export function WhyBookSection() {
  return (
    <section className={MARKETING_SECTION}>
      <MarketingContainer>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className={MARKETING_SECTION_TITLE}>
            Why book with us?
          </h2>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-primary" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12">
          {FEATURES.map(({ title, description, icon: Icon, iconClassName }) => (
            <article
              key={title}
              className="flex flex-col items-center rounded-2xl border-0 bg-brand-page p-6 text-center shadow-none"
            >
              <div
                className={cn(
                  "mb-5 flex size-14 items-center justify-center rounded-2xl",
                  iconClassName,
                )}
              >
                <Icon className="size-7" strokeWidth={2.2} aria-hidden />
              </div>
              <h3 className="font-brand text-lg font-extrabold text-brand">
                {title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
