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
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import { cn } from "@/lib/utils"

type PeaceCopy = {
  eyebrow: string
  heading: string
  items: string[]
}

const ICONS: { icon: LucideIcon; iconClassName: string }[] = [
  {
    icon: UserRoundIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    icon: PlaneIcon,
    iconClassName: "bg-[oklch(0.94_0.04_230)] text-[oklch(0.45_0.12_240)]",
  },
  {
    icon: MousePointerClickIcon,
    iconClassName: "bg-[oklch(0.96_0.06_70)] text-[oklch(0.55_0.14_70)]",
  },
  {
    icon: ShieldCheckIcon,
    iconClassName: "bg-[oklch(0.95_0.05_300)] text-[oklch(0.48_0.14_300)]",
  },
  {
    icon: CircleDollarSignIcon,
    iconClassName: "bg-accent text-primary",
  },
  {
    icon: ClockIcon,
    iconClassName: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.45_0.14_250)]",
  },
]

export function PeaceOfMindSection({ copy }: { copy: PeaceCopy }) {
  return (
    <section className="overflow-hidden bg-white py-10 md:pt-0 md:pb-0">
      <MarketingContainer>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-accent/70 p-5 md:rounded-3xl md:p-12 lg:p-16">
          <div className="mb-6 max-w-2xl md:mb-12">
            <span className="mb-2 block text-xs font-extrabold tracking-widest text-primary uppercase md:mb-3">
              {copy.eyebrow}
            </span>
            <h2 className={MARKETING_SECTION_TITLE}>{copy.heading}</h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {copy.items.map((title, index) => {
              const { icon: Icon, iconClassName } =
                ICONS[index % ICONS.length]!
              return (
                <div
                  key={`${title}-${index}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md md:rounded-2xl md:p-8"
                >
                  <h3 className="text-[0.95rem] font-extrabold leading-snug text-brand transition-colors group-hover:text-primary md:text-xl">
                    {title}
                  </h3>
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg md:size-12 md:rounded-xl",
                      iconClassName,
                    )}
                  >
                    <Icon
                      className="size-5 md:size-6"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </MarketingContainer>
    </section>
  )
}
