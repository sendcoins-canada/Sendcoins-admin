-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "allowedIps" JSONB,
ADD COLUMN     "lastMfaAt" TIMESTAMP(6),
ADD COLUMN     "mfaBackupCodes" JSONB,
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" VARCHAR(255);
