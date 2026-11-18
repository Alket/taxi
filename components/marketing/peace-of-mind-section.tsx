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
    <section className="overflow-hidden border-b border-border/60 bg-brand-page py-12 font-brand md:py-20 lg:py-24">
      <MarketingContainer>
        <div className="mb-8 max-w-2xl md:mb-14">
          {copy.eyebrow ? (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-3.5 py-1 text-xs font-bold tracking-wide text-brand-accent uppercase">
              {copy.eyebrow}
            </span>
          ) : null}
          {copy.heading ? (
            <h2 className={MARKETING_SECTION_TITLE}>{copy.heading}</h2>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {copy.items.map((item, index) => {
            const iconDef = getMarketingIcon(item.icon, index)
            const iconBoxClass = isCustomMarketingIcon(item.icon)
              ? CUSTOM_ICON_CLASSNAME
              : iconDef.iconClassName

            return (
              <article
                key={`${item.title}-${index}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border/80 bg-brand-surface p-5 shadow-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-accent/30 hover:shadow-md sm:p-6 md:p-7"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-brand text-base font-bold leading-snug text-brand transition-colors duration-200 group-hover:text-brand-accent sm:text-lg md:text-xl">
                    {item.title}
                  </h3>
                  {item.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-brand/80 dark:text-muted-foreground md:mt-2 md:text-[0.95rem]">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 sm:size-12 md:size-14 md:rounded-2xl",
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
              </article>
            )
          })}
        </div>
      </MarketingContainer>
    </section>
  )
}
