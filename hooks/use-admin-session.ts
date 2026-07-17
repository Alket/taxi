"use client"

import useSWR from "swr"

import { canDelete } from "@/lib/auth-client"
import { fetcher } from "@/lib/api"
import type { AdminUser } from "@/lib/types"

export function useAdminSession() {
  const { data, isLoading, error } = useSWR<{ user: AdminUser }>(
    "/api/admin/me",
    fetcher,
  )

  const user = data?.user ?? null

  return {
    user,
    isLoading,
    error,
    canDelete: canDelete(user),
  }
}
