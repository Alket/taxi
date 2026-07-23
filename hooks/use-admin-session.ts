"use client"

import useSWR from "swr"

import { canDelete, isAdmin } from "@/lib/auth-client"
import { fetcher } from "@/lib/api"
import type { AdminUser } from "@/lib/types"

export function useAdminSession() {
  const { data, isLoading, error } = useSWR<{ user: AdminUser }>(
    "/api/admin/me",
    fetcher,
  )

  const user = data?.user ?? null
  const admin = isAdmin(user)

  return {
    user,
    isLoading,
    error,
    isAdmin: admin,
    /** Alias: only full admins can permanently delete. */
    canDelete: canDelete(user),
  }
}
