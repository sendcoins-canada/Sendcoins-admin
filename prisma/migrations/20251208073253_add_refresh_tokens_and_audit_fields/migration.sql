-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'EXPORT_TRANSACTIONS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_ADMINS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_ROLES';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_DEPARTMENTS';
ALTER TYPE "Permission" ADD VALUE 'VIEW_DASHBOARD';
ALTER TYPE "Permission" ADD VALUE 'VIEW_ANALYTICS';
ALTER TYPE "Permission" ADD VALUE 'EXPORT_DATA';

-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN     "ipAddress" VARCHAR(45),
ADD COLUMN     "userAgent" VARCHAR(500);

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "deletedAt" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "AdminRefreshToken" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "deviceInfo" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRefreshToken_token_key" ON "AdminRefreshToken"("token");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_adminId_idx" ON "AdminRefreshToken"("adminId");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_token_idx" ON "AdminRefreshToken"("token");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_expiresAt_idx" ON "AdminRefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AdminRefreshToken" ADD CONSTRAINT "AdminRefreshToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
