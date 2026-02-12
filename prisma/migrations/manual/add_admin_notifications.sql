-- Migration: Add Admin Notifications
-- Safe to run on production - only adds new tables/columns, no data loss
-- Run with: psql $DATABASE_URL -f prisma/migrations/manual/add_admin_notifications.sql

-- 1. Add new enum types
CREATE TYPE "AdminNotificationType" AS ENUM (
  'ADMIN_LOGIN',
  'ADMIN_LOGIN_FAILED',
  'ADMIN_PASSWORD_CHANGED',
  'SUSPICIOUS_LOGIN_ATTEMPT',
  'NEW_IP_LOGIN',
  'ADMIN_CREATED',
  'ADMIN_DEACTIVATED',
  'ADMIN_ROLE_CHANGED',
  'TRANSACTION_FLAGGED',
  'TRANSACTION_APPROVED',
  'TRANSACTION_REJECTED',
  'HIGH_VALUE_TRANSACTION'
);

CREATE TYPE "AdminNotificationCategory" AS ENUM (
  'SECURITY',
  'ADMIN_MANAGEMENT',
  'TRANSACTION',
  'SYSTEM'
);

CREATE TYPE "AdminNotificationPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- 2. Add lastLoginIp column to AdminUser (safe - nullable column)
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "lastLoginIp" VARCHAR(45);

-- 3. Create AdminNotification table
CREATE TABLE IF NOT EXISTS "AdminNotification" (
  "id" SERIAL PRIMARY KEY,
  "adminId" INTEGER NOT NULL,
  "type" "AdminNotificationType" NOT NULL,
  "category" "AdminNotificationCategory" NOT NULL,
  "priority" "AdminNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(6),
  "actionUrl" VARCHAR(500),
  "emailSent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId")
    REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "AdminNotification_adminId_isRead_createdAt_idx"
  ON "AdminNotification"("adminId", "isRead", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AdminNotification_adminId_category_createdAt_idx"
  ON "AdminNotification"("adminId", "category", "createdAt" DESC);

-- 5. Add new permissions to Permission enum (safe - only adds values)
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'READ_NOTIFICATIONS';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'MANAGE_NOTIFICATION_SETTINGS';
