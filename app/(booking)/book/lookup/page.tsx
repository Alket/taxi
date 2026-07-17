import { redirect } from "next/navigation"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Alias for older confirmation CTAs pointing at /book/lookup. */
export default async function BookLookupRedirect({ searchParams }: PageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value)
  }
  const suffix = qs.toString()
  redirect(suffix ? `/my-booking?${suffix}` : "/my-booking")
}
