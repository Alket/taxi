import type { AdminRole, AdminUser } from "@/lib/types"

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  operator: "Operator",
}

/** Client-safe check: only admins can permanently delete. */
export function canDelete(
  user: Pick<AdminUser, "role"> | null | undefined,
): boolean {
  return user?.role === "admin"
}

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "admin" || role === "operator"
}
