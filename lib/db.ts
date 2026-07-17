import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion?: string
}

/** Bump when the Prisma schema changes so the dev singleton is recreated. */
const PRISMA_SCHEMA_VERSION = "driver-accepted-v1"

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION
) {
  void globalForPrisma.prisma?.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
