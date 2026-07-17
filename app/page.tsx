import type { Metadata } from "next"

import { HomeLanding } from "@/components/marketing/home-landing"

export const metadata: Metadata = {
  title: "Albania Transfers · Airport transfers",
  description:
    "Book reliable airport transfers across Albania. Fixed prices, vetted drivers, free cancellation window.",
}

export default function HomePage() {
  return <HomeLanding />
}
