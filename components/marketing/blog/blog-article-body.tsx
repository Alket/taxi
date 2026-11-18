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
  as: "p" | "h2" | "h3" | "li" | "td" | "span" | "div"
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
        "[&_a]:font-bold [&_a]:text-brand-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_a]:decoration-brand-accent/50 hover:[&_a]:decoration-brand-accent",
        "[&_strong]:font-extrabold [&_strong]:text-brand [&_b]:font-extrabold [&_b]:text-brand",
        "[&_em]:italic [&_i]:italic",
        "[&_code]:rounded-md [&_code]:bg-muted/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
        "[&_li]:leading-relaxed [&_li]:text-brand/80",
        "[&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-border/60 [&_img]:shadow-xs",
      )}
    >
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <RichHtml
                key={index}
                as="div"
                html={block.text}
                className="mb-5 text-base leading-relaxed text-brand/80 md:text-[1.0625rem]"
              />
            )
          case "image":
            return (
              <figure key={index} className="my-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.src}
                  alt={block.alt}
                  loading="lazy"
                  className="h-auto max-w-full rounded-2xl border border-border/60 shadow-xs"
                />
              </figure>
            )
          case "h2":
            return (
              <RichHtml
                key={index}
                as="h2"
                id={block.headingId}
                html={block.text}
                className="mt-10 mb-4 scroll-mt-28 border-b border-border/50 pb-2.5 font-brand text-2xl font-black tracking-tight text-brand md:text-3xl"
              />
            )
          case "h3":
            return (
              <RichHtml
                key={index}
                as="h3"
                html={block.text}
                className="mt-8 mb-3 font-brand text-xl font-extrabold tracking-tight text-brand"
              />
            )
          case "ul":
            return (
              <ul
                key={index}
                className="mb-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-brand/80 md:text-[1.0625rem]"
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
                className="mb-5 list-decimal space-y-2 pl-5 text-base leading-relaxed text-brand/80 md:text-[1.0625rem]"
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
                className="my-6 rounded-2xl border border-brand-accent/25 bg-brand-surface p-5 sm:p-6 shadow-2xs"
              >
                {block.title ? (
                  <RichHtml
                    as="div"
                    html={block.title}
                    className="font-brand text-sm font-extrabold text-brand"
                  />
                ) : null}
                <RichHtml
                  as="div"
                  html={block.text}
                  className={cn(
                    "text-base leading-relaxed text-brand/80",
                    block.title && "mt-1.5",
                  )}
                />
              </aside>
            )
          case "table":
            return (
              <div
                key={index}
                className="my-6 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border/80 bg-brand-surface shadow-2xs [-webkit-overflow-scrolling:touch]"
              >
                <table className="w-full min-w-0 border-collapse text-left text-sm md:min-w-[24rem]">
                  {block.caption ? (
                    <caption className="bg-brand-page/70 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                          className="max-w-[12rem] px-4 py-3 font-extrabold break-words sm:max-w-none"
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
                        className="border-t border-border/60 odd:bg-brand-surface even:bg-brand-page/40"
                      >
                        {row.map((cell, cellIndex) => (
                          <RichHtml
                            key={`${rowIndex}-${cellIndex}`}
                            as="td"
                            html={cell}
                            className="max-w-[12rem] px-4 py-3 align-top break-words text-brand/80 font-medium sm:max-w-none"
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "mid_cta":
            return <BlogMidCta key={index} locale={locale} block={block} />
          default:
            return null
        }
      })}
    </div>
  )
}
