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
import { apiPatch, fetcher } from "@/lib/api"
import {
  MARKETING_ICON_SELECT_ITEMS,
  getMarketingIcon,
  isCustomMarketingIcon,
} from "@/lib/marketing-icons"
import {
  PAGE_SECTION_TYPES,
  type PageContentRecord,
  type PageSection,
  type PageSectionType,
} from "@/lib/page-content-shared"
import type { MediaAssetDto } from "@/lib/media-shared"

const CONTENT_SECTION_TYPES = PAGE_SECTION_TYPES.filter(
  (t) => t !== "faq_item",
) as PageSectionType[]

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

function splitSections(sections: PageSection[]) {
  return {
    content: sections.filter((s) => s.type !== "faq_item"),
    faqs: sections.filter((s) => s.type === "faq_item"),
  }
}

function mergeSections(content: PageSection[], faqs: PageSection[]): PageSection[] {
  return [
    ...content,
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
            <Label className="text-xs text-muted-foreground">Alt text</Label>
            <Input
              value={section.alt ?? ""}
              onChange={(e) => onChange({ ...section, alt: e.target.value })}
            />
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
  const [page, setPage] = useState<PageContentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addType, setAddType] = useState<PageSectionType>("text")
  const [libraryTarget, setLibraryTarget] = useState<
    null | { type: "og" } | { type: "section"; id: string }
  >(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetcher<{ page: PageContentRecord }>(
        `/api/admin/pages/${slug}`,
      )
      setPage(data.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load page")
      router.push("/admin/pages")
    } finally {
      setLoading(false)
    }
  }, [router, slug])

  useEffect(() => {
    void load()
  }, [load])

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
      setPage({
        ...page,
        ogImage: asset.url,
        sections: page.slug.startsWith("destinations/")
          ? page.sections.map((section) =>
              section.type === "image" && section.key === "hero"
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
    if (!section || section.type !== "image") return
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
      const data = await apiPatch<{ page: PageContentRecord }>(
        `/api/admin/pages/${slug}`,
        {
          label: page.label,
          title: page.title,
          description: page.description,
          ogImage: page.ogImage,
          sections: page.sections,
        },
      )
      setPage(data.page)
      toast.success("Page saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
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
    setPage({
      ...page,
      sections,
      ...(isDestinationHero && next.src != null ? { ogImage: next.src } : {}),
    })
  }

  function moveContentSection(contentIndex: number, dir: -1 | 1) {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    const target = contentIndex + dir
    if (target < 0 || target >= content.length) return
    const next = [...content]
    ;[next[contentIndex], next[target]] = [next[target], next[contentIndex]]
    setPage({ ...page, sections: mergeSections(next, faqs) })
  }

  function removeContentSection(contentIndex: number) {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content.filter((_, i) => i !== contentIndex),
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
    const { content, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections([...content, newSection(addType)], faqs),
    })
  }

  function addFaqItem() {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(content, [...faqs, newFaqItem()]),
    })
  }

  function updateFaqItem(faqIndex: number, next: PageSection) {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    const nextFaqs = [...faqs]
    nextFaqs[faqIndex] = next
    setPage({ ...page, sections: mergeSections(content, nextFaqs) })
  }

  function moveFaqItem(faqIndex: number, dir: -1 | 1) {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    const target = faqIndex + dir
    if (target < 0 || target >= faqs.length) return
    const nextFaqs = [...faqs]
    ;[nextFaqs[faqIndex], nextFaqs[target]] = [
      nextFaqs[target],
      nextFaqs[faqIndex],
    ]
    setPage({ ...page, sections: mergeSections(content, nextFaqs) })
  }

  function removeFaqItem(faqIndex: number) {
    if (!page) return
    const { content, faqs } = splitSections(page.sections)
    setPage({
      ...page,
      sections: mergeSections(
        content,
        faqs.filter((_, i) => i !== faqIndex),
      ),
    })
  }

  if (loading || !page) {
    return (
      <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { content: contentSections, faqs: faqItems } = splitSections(
    page.sections,
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            nativeButton={false}
            render={<Link href="/admin/pages" />}
          >
            <ArrowLeft className="size-3.5" />
            All pages
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{page.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slug: <code className="text-xs">{page.slug}</code>
            {!page.fromDatabase ? " · showing defaults until saved" : null}
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

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
              {page.slug.startsWith("destinations/")
                ? "Card / page image"
                : "OG image"}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {page.slug.startsWith("destinations/")
                ? "Used on the homepage carousel and destination page hero."
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
                    sections: page.slug.startsWith("destinations/")
                      ? page.sections.map((section) =>
                          section.type === "image" && section.key === "hero"
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
                        sections: page.slug.startsWith("destinations/")
                          ? page.sections.map((section) =>
                              section.type === "image" && section.key === "hero"
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
              value={addType === "faq_item" ? "text" : addType}
              onValueChange={(v) => {
                if (v && CONTENT_SECTION_TYPES.includes(v as PageSectionType)) {
                  setAddType(v as PageSectionType)
                }
              }}
              items={CONTENT_SECTION_TYPES.map((t) => ({
                value: t,
                label: t.replace("_", " "),
              }))}
            >
              <SelectTrigger className="w-[140px]">
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
            const realIndex = page.sections.findIndex((s) => s.id === section.id)
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
                          !CONTENT_SECTION_TYPES.includes(v as PageSectionType)
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

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">FAQ items</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add as many Q&amp;A pairs as you need. They appear in this order on
              the page.
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
                  <Label className="text-xs text-muted-foreground">Answer</Label>
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

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => void save()} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <MediaPickerDialog
        open={libraryTarget != null}
        onOpenChange={(open) => {
          if (!open) setLibraryTarget(null)
        }}
        onSelect={applyLibraryAsset}
      />
    </div>
  )
}
