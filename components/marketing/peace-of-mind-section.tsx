import { MarketingIcon } from "@/components/marketing/marketing-icon"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"
import {
  CUSTOM_ICON_CLASSNAME,
  getMarketingIcon,
  isCustomMarketingIcon,
} from "@/lib/marketing-icons"
import { cn } from "@/lib/utils"

type PeaceCopy = {
  eyebrow: string
  heading: string
  items: { title: string; description: string; icon: string }[]
}

export function PeaceOfMindSection({ copy }: { copy: PeaceCopy }) {
  if (!copy.heading && copy.items.length === 0) return null

  return (
    <section className="overflow-hidden border-b border-border bg-brand-page py-10 font-brand md:py-20">
      <MarketingContainer>
        <div className="mb-6 max-w-2xl md:mb-12">
          {copy.eyebrow ? (
            <span className="mb-2 block text-xs font-semibold tracking-widest text-brand-accent uppercase md:mb-3">
              {copy.eyebrow}
            </span>
          ) : null}
          {copy.heading ? (
            <h2 className={MARKETING_SECTION_TITLE}>{copy.heading}</h2>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {copy.items.map((item, index) => {
            const iconDef = getMarketingIcon(item.icon, index)
            const iconBoxClass = isCustomMarketingIcon(item.icon)
              ? CUSTOM_ICON_CLASSNAME
              : iconDef.iconClassName

            return (
              <div
                key={`${item.title}-${index}`}
                className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-brand-surface px-4 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md md:rounded-2xl md:p-8"
              >
                <div className="min-w-0">
                  <h3 className="text-[0.95rem] font-medium leading-snug text-brand transition-colors group-hover:text-brand-accent md:text-xl">
                    {item.title}
                  </h3>
                  {item.description ? (
                    <p className="mt-1.5 text-sm font-normal leading-relaxed text-muted-foreground md:mt-2 md:text-base">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg md:size-12 md:rounded-xl",
                    iconBoxClass,
                  )}
                >
                  <MarketingIcon
                    icon={item.icon}
                    fallbackIndex={index}
                    className="size-5 text-current md:size-6"
                    imageClassName="size-5 md:size-6"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </MarketingContainer>
    </section>
  )
}
