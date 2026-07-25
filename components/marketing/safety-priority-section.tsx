import {
  MarketingContainer,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"

type SafetyCopy = {
  heading: string
  items: {
    title: string
    description: string
    image: string
    alt: string
  }[]
}

export function SafetyPrioritySection({ copy }: { copy: SafetyCopy }) {
  return (
    <section
      id="safety"
      className="overflow-hidden bg-white py-10 md:py-24"
    >
      <MarketingContainer>
        <div className="mb-6 md:mb-12 lg:mb-16">
          <h2 className={MARKETING_SECTION_TITLE}>{copy.heading}</h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
          {copy.items.map(({ title, description, image, alt }) => (
            <article key={title} className="group flex flex-col">
              <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-muted shadow-md sm:mb-6 sm:rounded-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={alt}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <h3 className="mb-2 text-xl font-extrabold text-brand md:mb-3 md:text-2xl">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {description}
              </p>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
