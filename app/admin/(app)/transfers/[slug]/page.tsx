import { redirect } from "next/navigation"

import { TransferEditorView } from "@/components/admin/transfer-editor-view"
import { getSession, isAdmin } from "@/lib/auth"

type Props = { params: Promise<{ slug: string }> }

export default async function AdminTransferEditPage({ params }: Props) {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  const { slug } = await params
  return <TransferEditorView slug={slug} />
}
