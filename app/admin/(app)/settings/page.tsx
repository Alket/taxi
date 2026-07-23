import { redirect } from "next/navigation"

import { SettingsView } from "@/components/settings/settings-view"
import { getSession, isAdmin } from "@/lib/auth"

export default async function SettingsPage() {
  const user = await getSession()
  if (!user || !isAdmin(user)) {
    redirect("/admin")
  }

  return <SettingsView />
}
