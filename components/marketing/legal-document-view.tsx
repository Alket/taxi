import Link from "next/link"
import {
  ArrowLeft,
  CookieIcon,
  FileTextIcon,
  ScaleIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react"

import { MarketingContainer } from "@/components/marketing/marketing-container"
import {
  DEFAULT_LOCALE,
  type Locale,
  localePath,
} from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { cn } from "@/lib/utils"

export type LegalBlock = {
  key: string
  heading: string
  text: string
}

const BLOCK_ICONS: Record<string, LucideIcon> = {
  collect: ShieldIcon,
  use: FileTextIcon,
  sharing: ShieldIcon,
  rights: ScaleIcon,
  contact: FileTextIcon,
  service: FileTextIcon,
  bookings: ScaleIcon,
  payments: FileTextIcon,
  liability: ShieldIcon,
  what: CookieIcon,
  how: CookieIcon,
  manage: ScaleIcon,
  third: ShieldIcon,
}

function PolicyBody({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean)
  const bullets = lines.filter((line) => line.startsWith("•") || line.startsWith("-"))
  const paragraphs = lines.filter(
    (line) => !line.startsWith("•") && !line.startsWith("-"),
  )

  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-[15px] leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {bullets.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-2.5">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-3 text-[15px] leading-relaxed text-brand"
            >
              <span
                className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-accent"
                aria-hidden
              />
              <span>{bullet.replace(/^[•\-]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function LegalDocumentView({
  title,
  intro,
  blocks,
  heroImage,
  locale = DEFAULT_LOCALE,
}: {
  title: string
  intro: string
  blocks: LegalBlock[]
  heroImage: string
  locale?: Locale
}) {
  return (
    <div>
      <section className="relative isolate -mt-24 h-[min(48svh,26rem)] min-h-[18rem] overflow-hidden md:h-[min(44svh,30rem)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-panel via-brand-panel/60 to-brand-panel/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-panel/55 via-transparent to-transparent" />

        <MarketingContainer className="relative z-10 flex h-full flex-col justify-end pb-10 pt-28 text-white md:pb-12 md:pt-32">
          <Link
            href={localePath("/", locale)}
            className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            {t(locale, "common.backHome")}
          </Link>
          <h1 className="max-w-3xl font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {intro}
          </p>
        </MarketingContainer>
      </section>

      <section className="bg-brand-page py-10 md:py-14">
        <MarketingContainer>
          <div className="grid gap-4">
            {blocks.map((block, index) => {
              const Icon = BLOCK_ICONS[block.key] ?? FileTextIcon
              return (
                <article
                  key={block.key}
                  className="overflow-hidden rounded-3xl border border-border bg-brand-surface shadow-sm"
                >
                  <div className="flex items-start gap-4 border-b border-border/70 px-5 py-5 sm:gap-5 sm:px-7 sm:py-6">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-page text-brand-accent",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-brand text-xl font-extrabold tracking-tight text-brand">
                          {block.heading}
                        </h2>
                        <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {block.text ? (
                    <div className="px-5 py-5 sm:px-7 sm:py-6">
                      <PolicyBody text={block.text} />
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </MarketingContainer>
      </section>
    </div>
  )
}
