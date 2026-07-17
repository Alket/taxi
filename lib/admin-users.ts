import type { AdminUser as PrismaAdminUser } from "@prisma/client"

import type { AdminUser } from "@/lib/types"

type AdminUserPublic = Pick<
  PrismaAdminUser,
  | "id"
  | "name"
  | "email"
  | "role"
  | "suspended"
  | "lastLoginAt"
  | "requiresPasswordReset"
>

export function serializeAdminUser(user: AdminUserPublic): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    suspended: user.suspended,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    requiresPasswordReset: user.requiresPasswordReset,
  }
}
