-- AlterTable
ALTER TABLE "PaypalOrderIntent" ADD COLUMN "checkoutNonce" TEXT;

-- AlterTable
ALTER TABLE "PokOrderIntent" ADD COLUMN "checkoutNonce" TEXT;
