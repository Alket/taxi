import {
  MarketingContainer,
  MARKETING_SECTION,
  MARKETING_SECTION_TITLE,
} from "@/components/marketing/marketing-container"

const FEATURES = [
  {
    title: "1000s of experienced drivers",
    description:
      "With thousands of drivers in one app, you can book a transfer wherever you are, even in times of high demand.",
    image: "/marketing/safety-drivers.png",
    alt: "Using the booking app to find nearby drivers",
  },
  {
    title: "Know your driver",
    description:
      "When you hop on an Albania Transfers ride, you'll know your driver's details, rating, and driving experience to make sure you're in safe hands.",
    image: "/marketing/safety-know-driver.png",
    alt: "Friendly professional driver ready for pickup",
  },
] as const

export function SafetyPrioritySection() {
  return (
    <section id="safety" className={`${MARKETING_SECTION} overflow-hidden`}>
      <MarketingContainer>
        <div className="mb-12 md:mb-16">
          <h2 className={MARKETING_SECTION_TITLE}>
            Safety is our #1 priority
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {FEATURES.map(({ title, description, image, alt }) => (
            <article key={title} className="group flex flex-col">
              <div className="relative mb-6 aspect-[16/10] w-full overflow-hidden rounded-3xl bg-muted shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={alt}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <h3 className="mb-3 text-2xl font-extrabold text-brand">
                {title}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  )
}
