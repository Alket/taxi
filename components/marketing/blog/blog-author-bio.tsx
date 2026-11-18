import Image from "next/image"

import type { BlogAuthor } from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"

export function BlogAuthorBio({
  author,
  locale,
}: {
  author: BlogAuthor
  locale: Locale
}) {
  const role =
    author.id === "landed-team"
      ? t(locale, "blog.authorRole")
      : author.role
  const bio =
    author.id === "landed-team"
      ? t(locale, "blog.authorBio")
      : author.bio

  return (
    <section
      aria-label={t(locale, "blog.author")}
      className="rounded-3xl border border-border/80 bg-brand-surface p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-brand-page/60 p-2.5 shadow-2xs sm:size-20">
          <Image
            src={author.avatar.src}
            alt={author.avatar.alt}
            width={author.avatar.width}
            height={author.avatar.height}
            className="size-full object-contain"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            {t(locale, "blog.author")}
          </p>
          <h2 className="mt-1 font-brand text-xl font-black text-brand sm:text-2xl">
            {author.name}
          </h2>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-brand-accent sm:text-sm">
            {role}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-brand/75 sm:text-base">
            {bio}
          </p>
        </div>
      </div>
    </section>
  )
}
