import { redirect } from "next/navigation"

import { PagesListView } from "@/components/admin/pages-list-view"
import { getSession, isAdmin } from "@/lib/auth"

export default async function AdminPagesPage() {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  return <PagesListView />
}
