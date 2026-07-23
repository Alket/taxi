import type { AdminRole, AdminUser } from "@/lib/types"

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  operator: "Operator",
}

/** Client-safe check: full admin (not operator). */
export function isAdmin(
  user: Pick<AdminUser, "role"> | null | undefined,
): boolean {
  return user?.role === "admin"
}

/** Client-safe check: only admins can permanently delete. */
export function canDelete(
  user: Pick<AdminUser, "role"> | null | undefined,
): boolean {
  return isAdmin(user)
}

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "admin" || role === "operator"
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}
