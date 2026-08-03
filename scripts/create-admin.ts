/**
 * Create or update the first production admin (no demo seed).
 *
 * Usage (on the VPS, after rebuild that includes this script):
 *   docker compose exec -e ADMIN_EMAIL=you@landedalbania.com \
 *     -e ADMIN_PASSWORD='your-strong-password' \
 *     -e ADMIN_NAME='Site Admin' \
 *     app npx tsx scripts/create-admin.ts
 *
 * Or without rebuild, from the host repo with DB reachable:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts
 */
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD ?? ""
  const name = (process.env.ADMIN_NAME ?? "Admin").trim() || "Admin"

  if (!email || !email.includes("@")) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.")
  }
  if (password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD to at least 8 characters.")
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "admin",
      requiresPasswordReset: false,
      suspended: false,
    },
    update: {
      name,
      passwordHash,
      role: "admin",
      requiresPasswordReset: false,
      suspended: false,
    },
  })

  console.log(`Admin ready: ${user.email} (${user.id})`)
  console.log("Login at https://landedalbania.com/admin/login")
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
