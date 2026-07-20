import type { ElementType, HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Shared width + gutters for homepage, /book, and other brand frontend pages. */
export const MARKETING_CONTAINER =
  "mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8"

/** Shared vertical rhythm + white canvas for homepage content sections. */
export const MARKETING_SECTION = "bg-white py-16 md:py-24"

/** Shared homepage section heading. */
export const MARKETING_SECTION_TITLE =
  "font-brand text-3xl font-extrabold tracking-tight text-brand sm:text-4xl"

type MarketingContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: ElementType
}

export function MarketingContainer({
  children,
  className,
  as: Comp = "div",
  ...props
}: MarketingContainerProps) {
  return (
    <Comp className={cn(MARKETING_CONTAINER, className)} {...props}>
      {children}
    </Comp>
  )
}
