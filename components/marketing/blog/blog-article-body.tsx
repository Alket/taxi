import {
  getPostH2Headings,
  slugifyHeading,
  type BlogBlock,
  type BlogPost,
} from "@/lib/blog"
import type { Locale } from "@/lib/i18n/locales"
import { sanitizeBlogHtml } from "@/lib/sanitize-blog-html"
import { BlogMidCta } from "@/components/marketing/blog/blog-mid-cta"
import { cn } from "@/lib/utils"

function assignH2Ids(blocks: BlogBlock[]): (BlogBlock & { headingId?: string })[] {
  const seen = new Map<string, number>()
  return blocks.map((block) => {
    if (block.type !== "h2") return block
    const base = slugifyHeading(block.text) || "section"
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const headingId = count === 0 ? base : `${base}-${count + 1}`
    return { ...block, headingId }
  })
}

function RichHtml({
  html,
  as: Comp,
  className,
  id,
}: {
  html: string
  as: "p" | "h2" | "h3" | "li" | "td" | "span"
  className?: string
  id?: string
}) {
  return (
    <Comp
      id={id}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(html) }}
    />
  )
}

export function BlogArticleBody({
  post,
  locale,
}: {
  post: BlogPost
  locale: Locale
}) {
  const blocks = assignH2Ids(post.blocks)
  // Ensure TOC ids stay in sync with rendered headings.
  void getPostH2Headings(post)

  return (
    <div
      className={cn(
        "min-w-0 max-w-full font-brand text-brand",
        "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_strong]:font-extrabold [&_strong]:text-brand [&_b]:font-extrabold [&_b]:text-brand",
        "[&_em]:italic [&_i]:italic",
        "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
      )}
    >
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <RichHtml
                key={index}
                as="p"
                html={block.text}
                className="mb-5 text-base leading-relaxed text-muted-foreground md:text-[1.05rem]"
              />
            )
          case "h2":
            return (
              <RichHtml
                key={index}
                as="h2"
                id={block.headingId}
                html={block.text}
                className="mt-10 mb-4 scroll-mt-28 text-2xl font-extrabold tracking-tight text-brand md:text-3xl"
              />
            )
          case "h3":
            return (
              <RichHtml
                key={index}
                as="h3"
                html={block.text}
                className="mt-7 mb-3 text-xl font-bold tracking-tight text-brand"
              />
            )
          case "ul":
            return (
              <ul
                key={index}
                className="mb-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground"
              >
                {block.items.map((item, itemIndex) => (
                  <RichHtml key={itemIndex} as="li" html={item} />
                ))}
              </ul>
            )
          case "ol":
            return (
              <ol
                key={index}
                className="mb-5 list-decimal space-y-2 pl-5 text-base leading-relaxed text-muted-foreground"
              >
                {block.items.map((item, itemIndex) => (
                  <RichHtml key={itemIndex} as="li" html={item} />
                ))}
              </ol>
            )
          case "callout":
            return (
              <aside
                key={index}
                className="mb-6 rounded-2xl border border-border bg-brand-page px-5 py-4"
              >
                {block.title ? (
                  <RichHtml
                    as="p"
                    html={block.title}
                    className="text-sm font-extrabold text-brand"
                  />
                ) : null}
                <RichHtml
                  as="p"
                  html={block.text}
                  className={cn(
                    "text-base leading-relaxed text-muted-foreground",
                    block.title && "mt-1",
                  )}
                />
              </aside>
            )
          case "table":
            return (
              <div
                key={index}
                className="mb-6 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border [-webkit-overflow-scrolling:touch]"
              >
                <table className="w-full min-w-0 border-collapse text-left text-sm md:min-w-[24rem]">
                  {block.caption ? (
                    <caption className="bg-brand-page px-4 py-3 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: sanitizeBlogHtml(block.caption),
                        }}
                      />
                    </caption>
                  ) : null}
                  <thead className="bg-brand-panel text-white">
                    <tr>
                      {block.headers.map((header, headerIndex) => (
                        <th
                          key={headerIndex}
                          scope="col"
                          className="max-w-[12rem] px-3 py-2.5 font-extrabold break-words sm:max-w-none sm:px-4 sm:py-3"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeBlogHtml(header),
                          }}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-t border-border odd:bg-brand-surface even:bg-brand-page/60"
                      >
                        {row.map((cell, cellIndex) => (
                          <RichHtml
                            key={`${rowIndex}-${cellIndex}`}
                            as="td"
                            html={cell}
                            className="max-w-[12rem] px-3 py-2.5 align-top break-words text-muted-foreground sm:max-w-none sm:px-4 sm:py-3"
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "mid_cta":
            return <BlogMidCta key={index} locale={locale} />
          default:
            return null
        }
      })}
    </div>
  )
}
