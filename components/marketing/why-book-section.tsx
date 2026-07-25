import { MarketingIcon } from "@/components/marketing/marketing-icon"
import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"

type WhyBookCopy = {
  heading: string
  items: { title: string; description: string; icon: string }[]
}

export function WhyBookSection({ copy }: { copy: WhyBookCopy }) {
  return (
    <section className="bg-white py-10 md:pt-24 md:pb-24">
      <MarketingContainer>
        <div className="mx-auto mb-8 max-w-2xl text-center md:mb-12">
          <h2 className={MARKETING_SECTION_TITLE}>{copy.heading}</h2>
          <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-primary" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 md:gap-8 lg:gap-12">
          {copy.items.map(({ title, description, icon }, index) => (
            <article
              key={`${title}-${index}`}
              className="flex items-start gap-4 rounded-2xl bg-brand-page p-4 text-left md:flex-col md:items-center md:p-6 md:text-center"
            >
              <MarketingIcon
                icon={icon}
                fallbackIndex={index}
                className="mb-0 size-12 shrink-0 md:mb-5 md:size-14"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-brand text-base font-extrabold text-brand md:text-lg">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground md:mt-2 md:max-w-xs">
                  {description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
