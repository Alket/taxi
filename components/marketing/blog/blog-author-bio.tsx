import Image from "next/image"

import type { BlogAuthor } from "@/lib/blog"

export function BlogAuthorBio({ author }: { author: BlogAuthor }) {
  return (
    <section
      aria-label="About the author"
      className="rounded-3xl border border-border bg-brand-surface p-5 sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-brand-page p-2">
          <Image
            src={author.avatar.src}
            alt={author.avatar.alt}
            width={author.avatar.width}
            height={author.avatar.height}
            className="h-auto w-full object-contain"
          />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Author
          </p>
          <h2 className="mt-1 font-brand text-xl font-extrabold text-brand">
            {author.name}
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-brand-accent">
            {author.role}
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {author.bio}
          </p>
        </div>
      </div>
    </section>
  )
}
