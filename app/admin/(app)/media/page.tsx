import { redirect } from "next/navigation"

import { MediaLibraryView } from "@/components/admin/media-library-view"
import { getSession, isAdmin } from "@/lib/auth"

export default async function AdminMediaPage() {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  return <MediaLibraryView />
}
