"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FolderOpen,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { apiDelete, apiPatch, fetcher } from "@/lib/api"
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "@/lib/i18n/locales"
import {
  MARKETING_ICON_SELECT_ITEMS,
  getMarketingIcon,
  isCustomMarketingIcon,
} from "@/lib/marketing-icons"
import {
  BLOG_META_KEYS,
  PAGE_SECTION_TYPES,
  isBlogSlug,
  isCorePageSlug,
  type PageContentRecord,
  type PageSection,
  type PageSectionType,
} from "@/lib/page-content-shared"
import {
  BlogCatalogManagerDialog,
  useBlogCatalog,
} from "@/components/admin/blog-catalog-manager"
import { toDateInputValue } from "@/components/admin/date-field"
import type { MediaAssetDto } from "@/lib/media-shared"
import { cn } from "@/lib/utils"

const CONTENT_SECTION_TYPES = PAGE_SECTION_TYPES.filter(
  (t) =>
    t !== "faq_item" &&
    t !== "attraction" &&
    t !== "callout" &&
    t !== "list" &&
    t !== "table" &&
    t !== "mid_cta",
) as PageSectionType[]

const BLOG_BODY_SECTION_TYPES = [
  "heading",
  "text",
  "image",
  "callout",
  "list",
  "table",
  "mid_cta",
] as PageSectionType[]
function newSection(type: PageSectionType): PageSection {
  return {
    id: crypto.randomUUID(),
    type,
    key: "",
    ...(type === "heading"
      ? { heading: "", level: 2 as const }
      : type === "text"
        ? { body: "" }
        : type === "image"
          ? { src: "", alt: "" }
          : type === "attraction"
            ? { heading: "", body: "", src: "", alt: "" }
            : type === "callout"
              ? { heading: "", body: "" }
              : type === "list"
                ? { items: [], listStyle: "ul" as const }
                : type === "table"
                  ? { heading: "", headers: ["Column A", "Column B"], rows: [["", ""]] }
                  : type === "mid_cta"
                    ? {}
                    : { question: "", answer: "" }),
  }
}

function newFaqItem(): PageSection {
  return {
    id: crypto.randomUUID(),
    type: "faq_item",
    key: "",
    question: "",
    answer: "",
  }
}

function newAttractionItem(): PageSection {
  return {
    id: crypto.randomUUID(),
    type: "attraction",
    key: "",
    heading: "",
    body: "",
    src: "",
    alt: "",
  }
}

function splitSections(sections: PageSection[]) {
  return {
    content: sections.filter(
      (s) =>
        s.type !== "faq_item" &&
        s.type !== "attraction" &&
        !s.key.startsWith("_") &&
        !s.key.startsWith("meta.") &&
        !s.key.startsWith("body.") &&
        s.key !== "title.heading" &&
        s.key !== "hero.image",
    ),
    settings: sections.filter(
      (s) => s.key.startsWith("meta.") || s.key === "title.heading",
    ),
    hero: sections.filter((s) => s.key === "hero.image"),
    body: sections
      .filter((s) => s.key.startsWith("body."))
      .sort((a, b) => {
        const na = Number(a.key.slice(5)) || 0
        const nb = Number(b.key.slice(5)) || 0
        return na - nb
      }),
    attractions: sections.filter((s) => s.type === "attraction"),
    faqs: sections.filter((s) => s.type === "faq_item"),
    metaKeys: sections.filter((s) => s.key.startsWith("_")),
  }
}

function defaultBlogSetting(key: string): PageSection {
  if (key === "title.heading") {
    return {
      id: crypto.randomUUID(),
      type: "heading",
      key,
      heading: "",
      level: 1,
    }
  }
  return {
    id: crypto.randomUUID(),
    type: "text",
    key,
    body: "",
  }
}

function ensureBlogParts(sections: PageSection[]) {
  const parts = splitSections(sections)
  const byKey = new Map(parts.settings.map((s) => [s.key, s]))
  const settings = BLOG_META_KEYS.map(
    (key) => byKey.get(key) ?? defaultBlogSetting(key),
  )
  const hero =
    parts.hero.length > 0
      ? parts.hero
      : [
          {
            id: crypto.randomUUID(),
            type: "image" as const,
            key: "hero.image",
            src: "",
            alt: "",
          },
        ]
  return {
    ...parts,
    settings,
    hero,
  }
}

function settingBody(settings: PageSection[], key: string): string {
  const section = settings.find((s) => s.key === key)
  if (!section) return ""
  if (section.key === "title.heading") return section.heading ?? ""
  return section.body ?? ""
}

function patchSetting(
  settings: PageSection[],
  key: string,
  value: string,
): PageSection[] {
  return settings.map((section) => {
    if (section.key !== key) return section
    if (key === "title.heading") {
      return { ...section, heading: value, level: 1 as const }
    }
    return { ...section, body: value }
  })
}

function mergeBlogSections(parts: {
  settings: PageSection[]
  hero: PageSection[]
  body: PageSection[]
  faqs: PageSection[]
  metaKeys: PageSection[]
}): PageSection[] {
  const body = parts.body.map((item, i) => ({
    ...item,
    key: `body.${i + 1}`,
  }))
  const faqs = parts.faqs.map((faq, i) => ({
    ...faq,
    type: "faq_item" as const,
    key: `faq.${i + 1}`,
  }))
  return [
    ...parts.settings,
    ...parts.hero,
    ...body,
    ...faqs,
    ...parts.metaKeys,
  ]
}

function mergeSections(
  content: PageSection[],
  attractions: PageSection[],
  faqs: PageSection[],
): PageSection[] {
  return [
    ...content,
    ...attractions.map((item, i) => ({
      ...item,
      type: "attraction" as const,
      key: `attraction.${i + 1}`,
    })),
    ...faqs.map((faq, i) => ({
      ...faq,
      type: "faq_item" as const,
      key: `faq.${i + 1}`,
    })),
  ]
}

function SectionFields({
  section,
  onChange,
  onUpload,
  onOpenLibrary,
  uploading,
}: {
  section: PageSection
  onChange: (next: PageSection) => void
  onUpload: (file: File) => Promise<string | null>
  onOpenLibrary: () => void
  uploading: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {section.type === "heading" && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Heading</Label>
            <Textarea
              rows={2}
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Level</Label>
            <Select
              value={String(section.level ?? 2)}
              onValueChange={(v) => {
                if (v == null) return
                onChange({
                  ...section,
                  level: Number(v) as 1 | 2 | 3,
                })
              }}
              items={[
                { value: "1", label: "H1" },
                { value: "2", label: "H2" },
                { value: "3", label: "H3" },
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1</SelectItem>
                <SelectItem value="2">H2</SelectItem>
                <SelectItem value="3">H3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Icon</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={
                  isCustomMarketingIcon(section.icon)
                    ? "custom"
                    : section.icon || "none"
                }
                onValueChange={(v) => {
                  if (v == null || v === "custom") return
                  onChange({
                    ...section,
                    icon: v === "none" ? undefined : v,
                  })
                }}
                items={[
                  { value: "none", label: "None" },
                  ...(isCustomMarketingIcon(section.icon)
                    ? [{ value: "custom", label: "Custom SVG" }]
                    : []),
                  ...MARKETING_ICON_SELECT_ITEMS,
                ]}
              >
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {isCustomMarketingIcon(section.icon) ? (
                    <SelectItem value="custom">Custom SVG</SelectItem>
                  ) : null}
                  {MARKETING_ICON_SELECT_ITEMS.map((item) => {
                    const Icon = getMarketingIcon(item.value).icon
                    return (
                      <SelectItem key={item.value} value={item.value}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-3.5" aria-hidden />
                          {item.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[0.8rem] font-medium hover:bg-muted">
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="sr-only"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (!file) return
                    const url = await onUpload(file)
                    if (url) onChange({ ...section, icon: url })
                  }}
                />
                <ImagePlus className="size-3.5" />
                {uploading ? "Uploading…" : "Upload SVG"}
              </label>
            </div>
            {isCustomMarketingIcon(section.icon) ? (
              <div className="mt-1 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section.icon}
                  alt=""
                  className="size-10 rounded-lg border bg-muted object-contain p-1.5"
                />
                <p className="truncate text-xs text-muted-foreground">
                  {section.icon}
                </p>
              </div>
            ) : null}
          </div>
        </>
      )}

      {section.type === "text" && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <Textarea
            rows={4}
            value={section.body ?? ""}
            onChange={(e) => onChange({ ...section, body: e.target.value })}
          />
        </div>
      )}

      {section.type === "image" && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Image URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                value={section.src ?? ""}
                placeholder="/uploads/pages/… or https://…"
                onChange={(e) => onChange({ ...section, src: e.target.value })}
                className="min-w-0 flex-1"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto gap-1.5 px-2.5 py-1.5 text-[0.8rem]"
                  onClick={onOpenLibrary}
                >
                  <FolderOpen className="size-3.5" />
                  Library
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[0.8rem] font-medium hover:bg-muted">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (!file) return
                      const url = await onUpload(file)
                      if (url) onChange({ ...section, src: url })
                    }}
                  />
                  <ImagePlus className="size-3.5" />
                  {uploading ? "Uploading…" : "Upload"}
                </label>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Alt text
              {section.key.includes("hero") ? (
                <span className="ml-1 font-semibold text-destructive">
                  (required for SEO)
                </span>
              ) : null}
            </Label>
            <Input
              value={section.alt ?? ""}
              onChange={(e) => onChange({ ...section, alt: e.target.value })}
              aria-required={section.key.includes("hero")}
            />
            {section.key.includes("hero") && section.src && !section.alt ? (
              <p className="text-xs text-destructive">
                Describe this hero image (e.g. destination + "airport
                transfer") so search engines and screen readers understand
                it.
              </p>
            ) : null}
          </div>
          {section.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={section.src}
              alt={section.alt || ""}
              className="mt-1 max-h-40 rounded-lg border object-cover sm:col-span-2"
            />
          ) : null}
        </>
      )}

      {section.type === "callout" && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Callout title (optional)
            </Label>
            <Input
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Callout text</Label>
            <Textarea
              rows={3}
              value={section.body ?? ""}
              onChange={(e) => onChange({ ...section, body: e.target.value })}
            />
          </div>
        </>
      )}

      {section.type === "list" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">List style</Label>
            <Select
              value={section.listStyle === "ol" ? "ol" : "ul"}
              onValueChange={(v) => {
                if (v !== "ul" && v !== "ol") return
                onChange({ ...section, listStyle: v })
              }}
              items={[
                { value: "ul", label: "Bullets" },
                { value: "ol", label: "Numbered" },
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ul">Bullets</SelectItem>
                <SelectItem value="ol">Numbered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Items (one per line)
            </Label>
            <Textarea
              rows={5}
              value={(section.items ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...section,
                  items: e.target.value
                    .split("\n")
                    .map((line) => line.trimEnd()),
                })
              }
            />
          </div>
        </>
      )}

      {section.type === "table" && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Caption (optional)
            </Label>
            <Input
              value={section.heading ?? ""}
              onChange={(e) =>
                onChange({ ...section, heading: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Headers (comma-separated)
            </Label>
            <Input
              value={(section.headers ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  ...section,
                  headers: e.target.value.split(",").map((h) => h.trim()),
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Rows (one row per line, cells separated by |)
            </Label>
            <Textarea
              rows={5}
              value={(section.rows ?? [])
                .map((row) => row.join(" | "))
                .join("\n")}
              onChange={(e) =>
                onChange({
                  ...section,
                  rows: e.target.value
                    .split("\n")
                    .filter((line) => line.trim().length > 0)
                    .map((line) =>
                      line.split("|").map((cell) => cell.trim()),
                    ),
                })
              }
            />
          </div>
        </>
      )}

      {section.type === "mid_cta" && (
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          Inserts the mid-article booking CTA (“Landing at Tirana Airport
          soon?”). No extra fields needed.
        </p>
      )}

      {section.type === "faq_item" && (
        <>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Question</Label>
            <Input
              value={section.question ?? ""}
              onChange={(e) =>
                onChange({ ...section, question: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Answer</Label>
            <Textarea
              rows={3}
              value={section.answer ?? ""}
              onChange={(e) =>
                onChange({ ...section, answer: e.target.value })
              }
            />
          </div>
        </>
      )}
    </div>
  )
}

export function PageEditorView({ slug }: { slug: string }) {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [page, setPage] = useState<PageContentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addType, setAddType] = useState<PageSectionType>("text")
  const [libraryTarget, setLibraryTarget] = useState<
    null | { type: "og" } | { type: "section"; id: string }
  >(null)
  const [catalogDialog, setCatalogDialog] = useState<
    null | "categories" | "authors"
  >(null)
  const { catalog, setCatalog } = useBlogCatalog()

  const load = useCallback(
    async (nextLocale: Locale) => {
      setLoading(true)
      try {
        const data = await fetcher<{ page: PageContentRecord }>(
          `/api/admin/pages/${slug}?locale=${nextLocale}`,
        )
        setPage(data.page)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load page")
        router.push("/admin/pages")
      } finally {
        setLoading(false)
      }
    },
    [router, slug],
  )

  useEffect(() => {
    void load(locale)
  }, [load, locale])

  function switchLocale(next: Locale) {
    if (next === locale) return
    setPage(null)
    setLocale(next)
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
        headers: { "ngrok-skip-browser-warning": "true" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Upload failed")
      }
      toast.success("Image uploaded")
      return data.url as string
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      return null
    } finally {
      setUploading(false)
    }
  }

  function applyLibraryAsset(asset: MediaAssetDto) {
    if (!page || !libraryTarget) return
    if (libraryTarget.type === "og") {
      const isDest = page.slug.startsWith("destinations/")
      const isBlog = isBlogSlug(page.slug)
      setPage({
        ...page,
        ogImage: asset.url,
        sections:
          isDest || isBlog
            ? page.sections.map((section) =>
                section.type === "image" &&
                section.key === (isBlog ? "hero.image" : "hero")
                  ? {
                      ...section,
                      src: asset.url,
                      ...(asset.alt ? { alt: asset.alt } : {}),
                    }
                  : section,
              )
            : page.sections,
      })
      return
    }
    const index = page.sections.findIndex((s) => s.id === libraryTarget.id)
    const section = index >= 0 ? page.sections[index] : null
    if (
      !section ||
      (section.type !== "image" && section.type !== "attraction")
    ) {
      return
    }
    updateSection(index, {
      ...section,
      src: asset.url,
      ...(asset.alt ? { alt: asset.alt } : {}),
    })
  }

  async function save() {
    if (!page) return
    setSaving(true)
    try {
      const sections = isBlogSlug(page.slug)
        ? mergeBlogSections(ensureBlogParts(page.sections))
        : page.sections
      const data = await apiPatch<{ page: PageContentRecord }>(
        `/api/admin/pages/${slug}?locale=${locale}`,
        {
          locale,
          label: page.label,
          title: page.title,
          description: page.description,
          ogImage: page.ogImage,
          sections,
        },
      )
      setPage(data.page)
      toast.success(
        locale === DEFAULT_LOCALE
          ? "Page saved"
          : `${LOCALE_LABELS[locale].label} translation saved`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function removePage() {
    if (!page) return
    const isDestination = page.slug.startsWith("destinations/")
    const isBlog = isBlogSlug(page.slug)
    const canDelete = isDestination || isBlog
    const canReset = page.fromDatabase && isCorePageSlug(page.slug)

    if (!canDelete && !canReset) {
      toast.error(
        page.fromDatabase
          ? "This page cannot be deleted."
          : "Nothing to reset — this page still uses defaults.",
      )
      return
    }

    const confirmed = window.confirm(
      canDelete
        ? isBlog
          ? "Delete this blog post? It will be removed from the site."
          : "Delete this destination? It will be removed from the site."
        : "Reset this page to built-in defaults? Your custom edits will be cleared.",
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await apiDelete<{ mode: "deleted" | "reset" }>(
        `/api/admin/pages/${slug}`,
      )
      toast.success(
        res.mode === "deleted"
          ? isBlog
            ? "Blog post deleted."
            : "Destination deleted."
          : "Page reset to defaults.",
      )
      router.push("/admin/pages")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  function updateSection(index: number, next: PageSection) {
    if (!page) return
    const sections = [...page.sections]
    sections[index] = next
    const isDestinationHero =
      page.slug.startsWith("destinations/") &&
      next.type === "image" &&
      next.key === "hero"
    const isBlogHero =
      isBlogSlug(page.slug) &&
      next.type === "image" &&
      next.key === "hero.image"
    setPage({
      ...page,
      sections,
      ...((isDestinationHero || isBlogHero) && next.src != null
        ? { ogImage: next.src }
        : {}),
    })
  }

  function setBlogParts(
    updater: (
      parts: ReturnType<typeof ensureBlogParts>,
    ) => ReturnType<typeof ensureBlogParts>,
  ) {
    if (!page) return
    const parts = ensureBlogParts(page.sections)
    setPage({ ...page, sections: mergeBlogSections(updater(parts)) })
  }

  function moveContentSection(contentIndex: number, dir: -1 | 1) {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    const target = contentIndex + dir
    if (target < 0 || target >= content.length) return
    const next = [...content]
    ;[next[contentIndex], next[target]] = [next[target], next[contentIndex]]
    setPage({ ...page, sections: mergeSections(next, attractions, faqs) })
  }

  function removeContentSection(contentIndex: number) {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content.filter((_, i) => i !== contentIndex),
        attractions,
        faqs,
      ),
    })
  }

  function addSection() {
    if (!page) return
    if (addType === "faq_item") {
      addFaqItem()
      return
    }
    if (isBlogSlug(page.slug)) {
      setBlogParts((parts) => ({
        ...parts,
        body: [...parts.body, newSection(addType)],
      }))
      return
    }
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        [...content, newSection(addType)],
        attractions,
        faqs,
      ),
    })
  }

  function addFaqItem() {
    if (!page) return
    if (isBlogSlug(page.slug)) {
      setBlogParts((parts) => ({
        ...parts,
        faqs: [...parts.faqs, newFaqItem()],
      }))
      return
    }
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(content, attractions, [...faqs, newFaqItem()]),
    })
  }

  function updateFaqItem(faqIndex: number, next: PageSection) {
    if (!page) return
    if (isBlogSlug(page.slug)) {
      setBlogParts((parts) => {
        const nextFaqs = [...parts.faqs]
        nextFaqs[faqIndex] = next
        return { ...parts, faqs: nextFaqs }
      })
      return
    }
    const { content, attractions, faqs } = splitSections(page.sections)
    const nextFaqs = [...faqs]
    nextFaqs[faqIndex] = next
    setPage({
      ...page,
      sections: mergeSections(content, attractions, nextFaqs),
    })
  }

  function moveFaqItem(faqIndex: number, dir: -1 | 1) {
    if (!page) return
    if (isBlogSlug(page.slug)) {
      setBlogParts((parts) => {
        const target = faqIndex + dir
        if (target < 0 || target >= parts.faqs.length) return parts
        const nextFaqs = [...parts.faqs]
        ;[nextFaqs[faqIndex], nextFaqs[target]] = [
          nextFaqs[target],
          nextFaqs[faqIndex],
        ]
        return { ...parts, faqs: nextFaqs }
      })
      return
    }
    const { content, attractions, faqs } = splitSections(page.sections)
    const target = faqIndex + dir
    if (target < 0 || target >= faqs.length) return
    const nextFaqs = [...faqs]
    ;[nextFaqs[faqIndex], nextFaqs[target]] = [
      nextFaqs[target],
      nextFaqs[faqIndex],
    ]
    setPage({
      ...page,
      sections: mergeSections(content, attractions, nextFaqs),
    })
  }

  function removeFaqItem(faqIndex: number) {
    if (!page) return
    if (isBlogSlug(page.slug)) {
      setBlogParts((parts) => ({
        ...parts,
        faqs: parts.faqs.filter((_, i) => i !== faqIndex),
      }))
      return
    }
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content,
        attractions,
        faqs.filter((_, i) => i !== faqIndex),
      ),
    })
  }

  function moveBodySection(bodyIndex: number, dir: -1 | 1) {
    setBlogParts((parts) => {
      const target = bodyIndex + dir
      if (target < 0 || target >= parts.body.length) return parts
      const next = [...parts.body]
      ;[next[bodyIndex], next[target]] = [next[target], next[bodyIndex]]
      return { ...parts, body: next }
    })
  }

  function removeBodySection(bodyIndex: number) {
    setBlogParts((parts) => ({
      ...parts,
      body: parts.body.filter((_, i) => i !== bodyIndex),
    }))
  }

  function addAttractionItem() {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content,
        [...attractions, newAttractionItem()],
        faqs,
      ),
    })
  }

  function updateAttractionItem(index: number, next: PageSection) {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    const nextItems = [...attractions]
    nextItems[index] = next
    setPage({
      ...page,
      sections: mergeSections(content, nextItems, faqs),
    })
  }

  function moveAttractionItem(index: number, dir: -1 | 1) {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    const target = index + dir
    if (target < 0 || target >= attractions.length) return
    const nextItems = [...attractions]
    ;[nextItems[index], nextItems[target]] = [
      nextItems[target],
      nextItems[index],
    ]
    setPage({
      ...page,
      sections: mergeSections(content, nextItems, faqs),
    })
  }

  function removeAttractionItem(index: number) {
    if (!page) return
    const { content, attractions, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content,
        attractions.filter((_, i) => i !== index),
        faqs,
      ),
    })
  }

  if (loading || !page) {
    return (
      <>
        <PageHeader title="Edit page" description="Loading…" />
        <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  const {
    content: contentSections,
    attractions: attractionItems,
    faqs: faqItems,
  } = splitSections(page.sections)
  const blogParts = isBlogSlug(page.slug)
    ? ensureBlogParts(page.sections)
    : null
  const isDestinationPage = page.slug.startsWith("destinations/")
  const isBlogPage = isBlogSlug(page.slug)
  const canDelete = isDestinationPage || isBlogPage
  const canReset = page.fromDatabase && isCorePageSlug(page.slug)
  const blogFeatured =
    blogParts != null &&
    blogParts.metaKeys.some(
      (s) =>
        s.key === "_featured" &&
        (s.body ?? "").trim().toLowerCase() === "featured",
    )
  const categoryOptions = catalog?.categories ?? []
  const authorOptions = catalog?.authors ?? []
  const sectionTypeOptions = isBlogPage
    ? BLOG_BODY_SECTION_TYPES
    : CONTENT_SECTION_TYPES
  const publishedValue = blogParts
    ? settingBody(blogParts.settings, "meta.publishedAt")
    : ""
  const updatedValue = blogParts
    ? settingBody(blogParts.settings, "meta.updatedAt")
    : ""
  const todayIso = toDateInputValue(new Date())

  return (
    <>
      <PageHeader
        title={page.label}
        description={
          page.fromDatabase
            ? `Slug: ${page.slug}`
            : `Slug: ${page.slug} · showing defaults until saved`
        }
        actions={
          <>
            {canDelete || canReset ? (
              <Button
                variant={canDelete ? "destructive" : "outline"}
                size="sm"
                className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
                disabled={deleting || saving}
                onClick={() => void removePage()}
              >
                <Trash2 className="size-3.5" />
                {deleting
                  ? "Working…"
                  : canDelete
                    ? "Delete"
                    : "Reset defaults"}
              </Button>
            ) : null}
            <Button
              size="sm"
              className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
              onClick={() => void save()}
              disabled={saving || deleting}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          nativeButton={false}
          render={<Link href="/admin/pages" />}
        >
          <ArrowLeft className="size-3.5" />
          All pages
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Language</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Edit SEO and section copy per locale. English is the fallback for
              the public site.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Content locale"
          >
            {LOCALES.map((code) => {
              const active = code === locale
              return (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={loading || saving}
                  onClick={() => switchLocale(code)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold tracking-wide transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {LOCALE_LABELS[code].short}
                </button>
              )
            })}
          </div>
        </div>
        {page.hasLocaleRow === false && locale !== DEFAULT_LOCALE ? (
          <p className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            No translation yet — showing empty fields; save to create the{" "}
            {LOCALE_LABELS[locale].label} row.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-4 md:p-6">
        <h2 className="text-sm font-semibold">SEO</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Title, description, and Open Graph image for search and social shares.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Admin label</Label>
            <Input
              value={page.label}
              onChange={(e) => setPage({ ...page, label: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={3}
              value={page.description}
              onChange={(e) =>
                setPage({ ...page, description: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {isDestinationPage || isBlogPage
                ? "Card / page image"
                : "OG image"}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {isDestinationPage
                ? "Used on the homepage carousel and destination page hero."
                : isBlogPage
                  ? "Used as the post hero and Open Graph image."
                  : "Open Graph image for search and social shares."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                value={page.ogImage}
                placeholder="/uploads/pages/… or https://…"
                onChange={(e) => {
                  const ogImage = e.target.value
                  setPage({
                    ...page,
                    ogImage,
                    sections:
                      isDestinationPage || isBlogPage
                        ? page.sections.map((section) =>
                            section.type === "image" &&
                            section.key ===
                              (isBlogPage ? "hero.image" : "hero")
                              ? { ...section, src: ogImage }
                              : section,
                          )
                        : page.sections,
                  })
                }}
                className="min-w-0 flex-1"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto gap-1.5 px-2.5 py-1.5 text-[0.8rem]"
                  onClick={() => setLibraryTarget({ type: "og" })}
                >
                  <FolderOpen className="size-3.5" />
                  Library
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[0.8rem] font-medium hover:bg-muted">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (!file) return
                      const url = await uploadImage(file)
                      if (!url) return
                      setPage({
                        ...page,
                        ogImage: url,
                        sections:
                          isDestinationPage || isBlogPage
                            ? page.sections.map((section) =>
                                section.type === "image" &&
                                section.key ===
                                  (isBlogPage ? "hero.image" : "hero")
                                  ? { ...section, src: url }
                                  : section,
                              )
                            : page.sections,
                      })
                    }}
                  />
                  <ImagePlus className="size-3.5" />
                  Upload
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isBlogPage && blogParts ? (
        <>
          <section className="rounded-xl border bg-card p-4 md:p-6">
            <h2 className="text-sm font-semibold">Post settings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Category, dates, author, and related destinations for this guide.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  Article H1
                </Label>
                <Input
                  value={settingBody(blogParts.settings, "title.heading")}
                  onChange={(e) =>
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "title.heading",
                        e.target.value,
                      ),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Category
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => setCatalogDialog("categories")}
                  >
                    Manage
                  </Button>
                </div>
                <Select
                  value={
                    settingBody(blogParts.settings, "meta.category") ||
                    categoryOptions[0]?.id ||
                    "airport-transport"
                  }
                  onValueChange={(v) => {
                    if (!v) return
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.category",
                        v,
                      ),
                    }))
                  }}
                  items={categoryOptions.map((c) => ({
                    value: c.id,
                    label: c.label,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Author</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => setCatalogDialog("authors")}
                  >
                    Manage
                  </Button>
                </div>
                <Select
                  value={
                    settingBody(blogParts.settings, "meta.authorId") ||
                    authorOptions[0]?.id ||
                    "landed-team"
                  }
                  onValueChange={(v) => {
                    if (!v) return
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.authorId",
                        v,
                      ),
                    }))
                  }}
                  items={authorOptions.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {authorOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Excerpt</Label>
                <Textarea
                  rows={2}
                  value={settingBody(blogParts.settings, "meta.excerpt")}
                  onChange={(e) =>
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.excerpt",
                        e.target.value,
                      ),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  Quick takeaway
                </Label>
                <Textarea
                  rows={2}
                  value={settingBody(blogParts.settings, "meta.quickTakeaway")}
                  onChange={(e) =>
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.quickTakeaway",
                        e.target.value,
                      ),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Published date
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(publishedValue) ? publishedValue : ""}
                    onChange={(e) =>
                      setBlogParts((parts) => ({
                        ...parts,
                        settings: patchSetting(
                          parts.settings,
                          "meta.publishedAt",
                          e.target.value,
                        ),
                      }))
                    }
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setBlogParts((parts) => ({
                        ...parts,
                        settings: patchSetting(
                          parts.settings,
                          "meta.publishedAt",
                          todayIso,
                        ),
                      }))
                    }
                  >
                    Today
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Updated date
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(updatedValue) ? updatedValue : ""}
                    onChange={(e) =>
                      setBlogParts((parts) => ({
                        ...parts,
                        settings: patchSetting(
                          parts.settings,
                          "meta.updatedAt",
                          e.target.value,
                        ),
                      }))
                    }
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setBlogParts((parts) => ({
                        ...parts,
                        settings: patchSetting(
                          parts.settings,
                          "meta.updatedAt",
                          todayIso,
                        ),
                      }))
                    }
                  >
                    Today
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Shown on the post as “Updated …”. Use Today after meaningful
                  edits.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Read time (minutes)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={settingBody(blogParts.settings, "meta.readTime")}
                  onChange={(e) =>
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.readTime",
                        e.target.value,
                      ),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Related destinations
                </Label>
                <Input
                  value={settingBody(
                    blogParts.settings,
                    "meta.relatedDestinations",
                  )}
                  placeholder="tirana, saranda, himare"
                  onChange={(e) =>
                    setBlogParts((parts) => ({
                      ...parts,
                      settings: patchSetting(
                        parts.settings,
                        "meta.relatedDestinations",
                        e.target.value,
                      ),
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated destination ids.
                </p>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="blog-featured"
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={blogFeatured}
                  onChange={(e) => {
                    const featured = e.target.checked
                    setBlogParts((parts) => {
                      const metaKeys = parts.metaKeys.filter(
                        (s) => s.key !== "_featured",
                      )
                      if (featured) {
                        metaKeys.push({
                          id: crypto.randomUUID(),
                          type: "text",
                          key: "_featured",
                          body: "featured",
                        })
                      }
                      return { ...parts, metaKeys }
                    })
                  }}
                />
                <Label htmlFor="blog-featured" className="text-sm font-normal">
                  Featured on blog archive
                </Label>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">Hero image</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Full-bleed hero at the top of the post. Synced with the OG image
                above.
              </p>
            </div>
            {blogParts.hero.map((section) => {
              return (
                <div
                  key={section.id}
                  className="rounded-xl border bg-card p-4 md:p-5"
                >
                  <SectionFields
                    section={section}
                    onChange={(next) => {
                      if (!page) return
                      const parts = ensureBlogParts(page.sections)
                      setPage({
                        ...page,
                        ...(next.src != null ? { ogImage: next.src } : {}),
                        sections: mergeBlogSections({
                          ...parts,
                          hero: [next],
                        }),
                      })
                    }}
                    onUpload={uploadImage}
                    onOpenLibrary={() =>
                      setLibraryTarget({ type: "section", id: section.id })
                    }
                    uploading={uploading}
                  />
                </div>
              )
            })}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Article body</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ordered blocks: headings, text, images, callouts, lists,
                  tables, or a mid-article CTA.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={
                    BLOG_BODY_SECTION_TYPES.includes(addType)
                      ? addType
                      : "text"
                  }
                  onValueChange={(v) => {
                    if (
                      v &&
                      BLOG_BODY_SECTION_TYPES.includes(v as PageSectionType)
                    ) {
                      setAddType(v as PageSectionType)
                    }
                  }}
                  items={BLOG_BODY_SECTION_TYPES.map((t) => ({
                    value: t,
                    label: t.replace("_", " "),
                  }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_BODY_SECTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addSection}>
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </div>

            {blogParts.body.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No body blocks yet. Add a heading, text, or other block.
              </p>
            ) : (
              blogParts.body.map((section, bodyIndex) => {
                const realIndex = page.sections.findIndex(
                  (s) => s.id === section.id,
                )
                return (
                  <div
                    key={section.id}
                    className="rounded-xl border bg-card p-4 md:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                          {section.type.replace("_", " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{bodyIndex + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Select
                          value={section.type}
                          onValueChange={(v) => {
                            if (
                              !v ||
                              !BLOG_BODY_SECTION_TYPES.includes(
                                v as PageSectionType,
                              )
                            ) {
                              return
                            }
                            const next = {
                              ...newSection(v as PageSectionType),
                              id: section.id,
                              key: section.key,
                            }
                            if (realIndex >= 0) {
                              updateSection(realIndex, next)
                              return
                            }
                            setBlogParts((parts) => {
                              const body = [...parts.body]
                              body[bodyIndex] = next
                              return { ...parts, body }
                            })
                          }}
                          items={BLOG_BODY_SECTION_TYPES.map((t) => ({
                            value: t,
                            label: t.replace("_", " "),
                          }))}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOG_BODY_SECTION_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={bodyIndex === 0}
                          onClick={() => moveBodySection(bodyIndex, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={bodyIndex === blogParts.body.length - 1}
                          onClick={() => moveBodySection(bodyIndex, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => removeBodySection(bodyIndex)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <SectionFields
                      section={section}
                      onChange={(next) => {
                        if (realIndex >= 0) {
                          updateSection(realIndex, next)
                          return
                        }
                        setBlogParts((parts) => {
                          const body = [...parts.body]
                          body[bodyIndex] = next
                          return { ...parts, body }
                        })
                      }}
                      onUpload={uploadImage}
                      onOpenLibrary={() =>
                        setLibraryTarget({ type: "section", id: section.id })
                      }
                      uploading={uploading}
                    />
                  </div>
                )
              })
            )}
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Sections</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Heading, text, and image blocks in display order.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={
                  sectionTypeOptions.includes(addType) ? addType : "text"
                }
                onValueChange={(v) => {
                  if (
                    v &&
                    sectionTypeOptions.includes(v as PageSectionType)
                  ) {
                    setAddType(v as PageSectionType)
                  }
                }}
                items={sectionTypeOptions.map((t) => ({
                  value: t,
                  label: t.replace("_", " "),
                }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectionTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addSection}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>

          {contentSections.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No content sections yet. Add a heading, text, or image block.
            </p>
          ) : (
            contentSections.map((section, contentIndex) => {
              const realIndex = page.sections.findIndex(
                (s) => s.id === section.id,
              )
              return (
                <div
                  key={section.id}
                  className="rounded-xl border bg-card p-4 md:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {section.type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #{contentIndex + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={section.type}
                        onValueChange={(v) => {
                          if (
                            !v ||
                            !CONTENT_SECTION_TYPES.includes(
                              v as PageSectionType,
                            )
                          ) {
                            return
                          }
                          if (realIndex < 0) return
                          updateSection(realIndex, {
                            ...newSection(v as PageSectionType),
                            id: section.id,
                            key: section.key,
                          })
                        }}
                        items={CONTENT_SECTION_TYPES.map((t) => ({
                          value: t,
                          label: t.replace("_", " "),
                        }))}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTENT_SECTION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={contentIndex === 0}
                        onClick={() => moveContentSection(contentIndex, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={contentIndex === contentSections.length - 1}
                        onClick={() => moveContentSection(contentIndex, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => removeContentSection(contentIndex)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <SectionFields
                    section={section}
                    onChange={(next) => {
                      if (realIndex < 0) return
                      updateSection(realIndex, next)
                    }}
                    onUpload={uploadImage}
                    onOpenLibrary={() =>
                      setLibraryTarget({ type: "section", id: section.id })
                    }
                    uploading={uploading}
                  />
                </div>
              )
            })
          )}
        </section>
      )}

      {isDestinationPage ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Attractions</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Add places to visit for this destination. They appear in this
                order on the destination page.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addAttractionItem}>
              <Plus className="size-3.5" />
              Add attraction
            </Button>
          </div>

          {attractionItems.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No attractions yet. Click &ldquo;Add attraction&rdquo; to create
              the first one.
            </p>
          ) : (
            attractionItems.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 md:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    Attraction #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 0}
                      onClick={() => moveAttractionItem(index, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === attractionItems.length - 1}
                      onClick={() => moveAttractionItem(index, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => removeAttractionItem(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Title
                    </Label>
                    <Input
                      value={item.heading ?? ""}
                      placeholder="e.g. Theth Waterfall"
                      onChange={(e) =>
                        updateAttractionItem(index, {
                          ...item,
                          heading: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      rows={3}
                      value={item.body ?? ""}
                      placeholder="Short description visitors will see…"
                      onChange={(e) =>
                        updateAttractionItem(index, {
                          ...item,
                          body: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Image
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Input
                        value={item.src ?? ""}
                        placeholder="/uploads/pages/… or https://…"
                        onChange={(e) =>
                          updateAttractionItem(index, {
                            ...item,
                            src: e.target.value,
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLibraryTarget({ type: "section", id: item.id })
                        }
                      >
                        <FolderOpen className="size-3.5" />
                        Library
                      </Button>
                      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ""
                            if (!file) return
                            const url = await uploadImage(file)
                            if (!url) return
                            updateAttractionItem(index, {
                              ...item,
                              src: url,
                            })
                          }}
                        />
                        <ImagePlus className="size-3.5" />
                        Upload
                      </label>
                    </div>
                    {item.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.src}
                        alt={item.alt || item.heading || ""}
                        className="mt-1 h-32 w-full rounded-lg border object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Image alt text
                    </Label>
                    <Input
                      value={item.alt ?? ""}
                      placeholder="Describe the image for accessibility"
                      onChange={(e) =>
                        updateAttractionItem(index, {
                          ...item,
                          alt: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {!isDestinationPage ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">FAQ items</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Add as many Q&amp;A pairs as you need. They appear in this order
                on the page.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addFaqItem}>
              <Plus className="size-3.5" />
              Add FAQ
            </Button>
          </div>

          {faqItems.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No FAQ items yet. Click &ldquo;Add FAQ&rdquo; to create the first
              one.
            </p>
          ) : (
            faqItems.map((faq, faqIndex) => (
              <div
                key={faq.id}
                className="rounded-xl border bg-card p-4 md:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      FAQ #{faqIndex + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={faqIndex === 0}
                      onClick={() => moveFaqItem(faqIndex, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={faqIndex === faqItems.length - 1}
                      onClick={() => moveFaqItem(faqIndex, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => removeFaqItem(faqIndex)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Question
                    </Label>
                    <Input
                      value={faq.question ?? ""}
                      placeholder="e.g. How far in advance should I book?"
                      onChange={(e) =>
                        updateFaqItem(faqIndex, {
                          ...faq,
                          question: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Answer
                    </Label>
                    <Textarea
                      rows={3}
                      value={faq.answer ?? ""}
                      placeholder="Write the answer shown on the site…"
                      onChange={(e) =>
                        updateFaqItem(faqIndex, {
                          ...faq,
                          answer: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => void save()} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
      </div>

      <MediaPickerDialog
        open={libraryTarget != null}
        onOpenChange={(open) => {
          if (!open) setLibraryTarget(null)
        }}
        onSelect={applyLibraryAsset}
      />

      {catalog ? (
        <BlogCatalogManagerDialog
          open={catalogDialog != null}
          onOpenChange={(open) => {
            if (!open) setCatalogDialog(null)
          }}
          initial={catalog}
          mode={catalogDialog === "authors" ? "authors" : "categories"}
          onSaved={(next) => setCatalog(next)}
        />
      ) : null}
    </>
  )
}
