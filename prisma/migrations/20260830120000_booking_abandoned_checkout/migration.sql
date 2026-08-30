-- AlterEnum BookingStatus
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'abandoned';

-- AlterEnum NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'checkout_abandoned';
