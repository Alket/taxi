import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { DriverLoginView } from "@/components/driver/driver-login-form"
import { getDriverSession } from "@/lib/driver-auth"

export const metadata: Metadata = {
  title: "Driver Sign In",
}

export default async function DriverLoginPage() {
  const driver = await getDriverSession()
  if (driver) {
    redirect("/driver")
  }
  return <DriverLoginView />
}
