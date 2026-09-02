"use client"

import { useEffect, useMemo, useState } from "react"
import { Braces, Copy, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { applyTransferJsonToSeed } from "@/lib/transfers/apply-transfer-json"
import { parseTransferSeedJsonText } from "@/lib/transfers/transfer-seed-schema"
import type { Locale } from "@/lib/i18n/locales"
import { LOCALE_LABELS } from "@/lib/i18n/locales"
import type { TransferRouteSeed } from "@/lib/transfers/routes"

export function TransferJsonDialog({
  open,
  onOpenChange,
  seed,
  locale,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed: TransferRouteSeed
  locale: Locale
  onApply: (next: TransferRouteSeed) => void
}) {
  const localeLabel = LOCALE_LABELS[locale]?.label ?? locale
  const exportText = useMemo(() => JSON.stringify(seed, null, 2), [seed])
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (open) setDraft(exportText)
  }, [open, exportText])

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText || draft)
      toast.success("Transfer JSON copied")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  function applyImport() {
    let parsed: TransferRouteSeed
    try {
      parsed = parseTransferSeedJsonText(draft)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid transfer JSON")
      return
    }

    const confirmed = window.confirm(
      `Replace all content for ${localeLabel}? This overwrites the editor for this language only. Click Save afterward to persist.`,
    )
    if (!confirmed) return

    const { seed: next, slugMismatch, jsonSlug, pageSlug } =
      applyTransferJsonToSeed(seed.slug, parsed)

    onApply(next)
    onOpenChange(false)

    if (slugMismatch) {
      toast.message("JSON applied", {
        description: `Kept route slug “${pageSlug}” (JSON had “${jsonSlug}”). Save to persist ${localeLabel}.`,
      })
    } else {
      toast.success(`JSON applied for ${localeLabel} — click Save to persist`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Braces className="size-4" />
            Transfer JSON · {localeLabel}
          </DialogTitle>
          <DialogDescription>
            Export this language’s transfer as JSON, or paste a translation and
            apply it to the editor. Changes are local until you Save.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-1 py-3">
          <Label className="text-xs text-muted-foreground">JSON</Label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="min-h-[min(50vh,28rem)] flex-1 resize-y font-mono text-[0.75rem] leading-relaxed"
            placeholder='{ "slug": "tirana-airport-to-…", "destinationName": "…", … }'
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void copyExport()}
          >
            <Copy className="size-3.5" />
            Copy export
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={applyImport}
            >
              <Upload className="size-3.5" />
              Apply to editor
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
