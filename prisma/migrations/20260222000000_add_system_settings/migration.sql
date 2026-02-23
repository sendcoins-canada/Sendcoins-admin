-- CreateTable: system_settings for admin backend config
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT NOT NULL,
    "setting_type" VARCHAR(20) NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_setting_key_key" ON "system_settings"("setting_key");
CREATE INDEX IF NOT EXISTS "idx_system_settings_key" ON "system_settings"("setting_key");

-- Insert default conversion auto-approval threshold
INSERT INTO "system_settings" ("setting_key", "setting_value", "setting_type", "description", "updated_by")
VALUES (
    'conversion_auto_approve_threshold_usd',
    '500',
    'number',
    'USD threshold for automatic conversion approval. Conversions below this amount are auto-approved.',
    'system'
) ON CONFLICT ("setting_key") DO NOTHING;
