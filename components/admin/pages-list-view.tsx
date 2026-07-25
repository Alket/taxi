"use client"

import Link from "next/link"
import useSWR from "swr"
import { ExternalLink, FileText, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetcher } from "@/lib/api"

type AdminPageRow = {
  slug: string
  label: string
  path: string
  title: string
  updatedAt: string | null
  fromDatabase: boolean
}

export function PagesListView() {
  const { data, isLoading } = useSWR<{ pages: AdminPageRow[] }>(
    "/api/admin/pages",
    fetcher,
  )
  const pages = data?.pages ?? []

  return (
    <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit marketing copy, images, FAQs, and SEO for each site page.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                SEO title
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Status
              </th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-5 w-full max-w-md" />
                  </td>
                </tr>
              ))}
            {!isLoading &&
              pages.map((page) => (
                <tr
                  key={page.slug}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{page.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {page.path}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {page.title}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span
                      className={
                        page.fromDatabase
                          ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {page.fromDatabase ? "Customized" : "Defaults"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={page.path}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-3.5" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/pages/${page.slug}`} />}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
