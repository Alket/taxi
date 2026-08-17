import { redirect } from "next/navigation"

import { TransfersListView } from "@/components/admin/transfers-list-view"
import { getSession, isAdmin } from "@/lib/auth"

export default async function AdminTransfersPage() {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  return <TransfersListView />
}
