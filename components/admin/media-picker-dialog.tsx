"use client"

import * as React from "react"
import useSWR from "swr"
import { ImagesIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { fetcher } from "@/lib/api"
import type { MediaAssetDto } from "@/lib/media-shared"
import { cn } from "@/lib/utils"

type MediaListResponse = { assets: MediaAssetDto[] }

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (asset: MediaAssetDto) => void
}) {
  const { data, isLoading } = useSWR<MediaListResponse>(
    open ? "/api/admin/media" : null,
    fetcher,
  )
  const [query, setQuery] = React.useState("")
  const assets = data?.assets ?? []

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(
      (asset) =>
        asset.title.toLowerCase().includes(q) ||
        asset.alt.toLowerCase().includes(q) ||
        asset.filename.toLowerCase().includes(q) ||
        asset.description.toLowerCase().includes(q),
    )
  }, [assets, query])

  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12">
          <DialogTitle>Choose from library</DialogTitle>
          <DialogDescription>
            Select an image to insert into this field.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b px-4 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, alt, filename…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <ImagesIcon className="size-8 opacity-40" />
              {assets.length === 0
                ? "No images yet. Upload some in Media."
                : "No matching images."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors",
                    "hover:border-primary hover:ring-2 hover:ring-primary/20",
                  )}
                >
                  <div className="relative aspect-square bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.alt || asset.title}
                      className="absolute inset-0 size-full object-cover"
                    />
                  </div>
                  <div className="space-y-0.5 p-2.5">
                    <p className="truncate text-xs font-semibold">
                      {asset.title || asset.filename}
                    </p>
                    {asset.alt ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {asset.alt}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
