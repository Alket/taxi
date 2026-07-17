-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'operator');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'admin';
