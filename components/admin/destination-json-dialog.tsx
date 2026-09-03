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
import {
  applyDestinationJsonToPage,
  pageContentToDestinationDocument,
} from "@/lib/apply-destination-json"
import { parseDestinationDocumentJsonText } from "@/lib/destination-json-schema"
import type { Locale } from "@/lib/i18n/locales"
import { LOCALE_LABELS } from "@/lib/i18n/locales"
import type { PageContentRecord } from "@/lib/page-content-shared"

export function DestinationJsonDialog({
  open,
  onOpenChange,
  page,
  locale,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: PageContentRecord
  locale: Locale
  onApply: (next: PageContentRecord) => void
}) {
  const localeLabel = LOCALE_LABELS[locale]?.label ?? locale
  const exportText = useMemo(() => {
    const doc = pageContentToDestinationDocument(page)
    if (!doc) return ""
    return JSON.stringify(doc, null, 2)
  }, [page])

  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (open) setDraft(exportText)
  }, [open, exportText])

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText || draft)
      toast.success("Destination JSON copied")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  function applyImport() {
    let doc
    try {
      doc = parseDestinationDocumentJsonText(draft)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid destination JSON",
      )
      return
    }

    const confirmed = window.confirm(
      `Replace all content for ${localeLabel}? This overwrites the editor for this language only. Click Save afterward to persist.`,
    )
    if (!confirmed) return

    const { page: next, slugMismatch, jsonSlug, pageSlug } =
      applyDestinationJsonToPage(page, doc)

    onApply(next)
    onOpenChange(false)

    if (slugMismatch) {
      toast.message("JSON applied", {
        description: `Kept page slug “${pageSlug}” (JSON had “${jsonSlug}”). Save to persist ${localeLabel}.`,
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
            Destination JSON · {localeLabel}
          </DialogTitle>
          <DialogDescription>
            Export this language’s destination as DestinationDocument JSON, or
            paste a translation and apply it to the editor. Changes are local
            until you Save.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-1 py-3">
          <Label className="text-xs text-muted-foreground">JSON</Label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="min-h-[min(50vh,28rem)] flex-1 resize-y font-mono text-[0.75rem] leading-relaxed"
            placeholder='{ "format": "destination_v2", "meta": { ... }, "sections": [ ... ] }'
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void copyExport()}
            disabled={!exportText && !draft.trim()}
          >
            <Copy className="size-3.5" />
            Copy export
          </Button>
          <div className="flex flex-wrap gap-2">
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
              disabled={!draft.trim()}
            >
              <Upload className="size-3.5" />
              Apply to {localeLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
