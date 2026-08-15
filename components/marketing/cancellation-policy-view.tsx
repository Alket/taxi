import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BanIcon,
  ClipboardListIcon,
  ShieldCheckIcon,
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

type PolicyBlock = {
  key: string
  heading: string
  text: string
}

const BLOCK_META: Record<
  string,
  { icon: LucideIcon; accent: string; summaryKey: string }
> = {
  customer: {
    icon: BanIcon,
    accent: "text-brand-accent",
    summaryKey: "policy.summary.customer",
  },
  refund: {
    icon: ShieldCheckIcon,
    accent: "text-brand-accent",
    summaryKey: "policy.summary.refund",
  },
  how: {
    icon: ClipboardListIcon,
    accent: "text-brand-accent",
    summaryKey: "policy.summary.how",
  },
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

export function CancellationPolicyView({
  title,
  intro,
  blocks,
  heroImage,
  locale = DEFAULT_LOCALE,
  cashOnArrivalNote = null,
}: {
  title: string
  intro: string
  blocks: PolicyBlock[]
  heroImage: string
  locale?: Locale
  /** Shown under Customer cancellations when cash on arrival is enabled. */
  cashOnArrivalNote?: string | null
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
          <div className="rounded-3xl border border-brand-accent/20 bg-brand-surface px-5 py-5 shadow-sm sm:px-7 sm:py-6">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand-accent uppercase">
              {t(locale, "policy.keyTakeaway")}
            </p>
            <p className="mt-2 text-base font-bold leading-snug text-brand sm:text-lg">
              {t(locale, "policy.takeawayBody")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:mt-10">
            {blocks.map((block, index) => {
              const meta = BLOCK_META[block.key]
              const Icon = meta?.icon ?? ClipboardListIcon
              return (
                <article
                  key={block.key}
                  className="overflow-hidden rounded-3xl border border-border bg-brand-surface shadow-sm"
                >
                  <div className="flex items-start gap-4 border-b border-border/70 px-5 py-5 sm:gap-5 sm:px-7 sm:py-6">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-page",
                        meta?.accent,
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
                      {meta?.summaryKey ? (
                        <p className="mt-1 text-sm font-semibold text-brand-accent">
                          {t(locale, meta.summaryKey)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {block.text ? (
                    <div className="px-5 py-5 sm:px-7 sm:py-6">
                      <PolicyBody text={block.text} />
                    </div>
                  ) : null}
                  {block.key === "customer" && cashOnArrivalNote ? (
                    <div className="border-t border-border/70 bg-brand-page/60 px-5 py-5 sm:px-7 sm:py-6">
                      <p className="text-[15px] leading-relaxed text-brand">
                        <span className="font-extrabold text-brand-accent">
                          {t(locale, "policy.cashOnArrivalNoteLabel")}{" "}
                        </span>
                        {cashOnArrivalNote}
                      </p>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>

          <aside
            aria-label={t(locale, "policy.needCancelTitle")}
            className="mt-10 overflow-hidden rounded-3xl border border-border bg-brand-surface md:mt-12"
          >
            <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9 md:flex-row md:items-center md:justify-between md:gap-10">
              <div className="max-w-2xl">
                <p className="text-xs font-bold tracking-[0.14em] text-brand-accent uppercase">
                  {t(locale, "policy.summary.how")}
                </p>
                <h2 className="mt-2 font-brand text-2xl font-extrabold tracking-tight text-brand md:text-3xl">
                  {t(locale, "policy.needCancelTitle")}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {t(locale, "policy.needCancelText")}
                </p>
              </div>
              <Link
                href={localePath("/my-booking", locale)}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-accent px-7 text-sm font-extrabold text-white transition-colors hover:bg-brand-accent-hover"
              >
                {t(locale, "nav.myBooking")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div
              className="h-1.5 w-full bg-[color-mix(in_srgb,var(--brand-accent)_35%,transparent)]"
              aria-hidden
            />
          </aside>
        </MarketingContainer>
      </section>
    </div>
  )
}
