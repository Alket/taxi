import { redirect } from "next/navigation"

import { PageEditorView } from "@/components/admin/page-editor-view"
import { getSession, isAdmin } from "@/lib/auth"
import { resolvePageDefinition } from "@/lib/page-content"

type PageProps = {
  params: Promise<{ slug: string[] }>
}

export default async function AdminPageEditorPage({ params }: PageProps) {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  const slug = (await params).slug.join("/")
  const def = await resolvePageDefinition(slug)
  if (!def) {
    redirect("/admin/pages")
  }

  return <PageEditorView slug={slug} />
}
