"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { apiPost } from "@/lib/api"
import { useAdminSession } from "@/hooks/use-admin-session"

/**
 * Recovers from stale/invalid sessions. A cookie can pass middleware (valid
 * signature) while its user no longer resolves in the database, which makes
 * every admin API return 401. When that happens we clear the cookie and send
 * the user back to login instead of leaving them stuck.
 */
export function SessionGuard() {
  const { error } = useAdminSession()
  const router = useRouter()
  const handledRef = React.useRef(false)

  React.useEffect(() => {
    const status = (error as { status?: number } | undefined)?.status
    const isUnauthorized =
      status === 401 || (error && /unauthorized/i.test(error.message))

    if (!isUnauthorized || handledRef.current) {
      return
    }
    handledRef.current = true

    void apiPost("/api/admin/logout")
      .catch(() => {})
      .finally(() => {
        router.push("/admin/login")
        router.refresh()
      })
  }, [error, router])

  return null
}
