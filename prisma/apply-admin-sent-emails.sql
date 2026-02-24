-- Create admin_sent_emails table for Mail screen (run once: npx prisma db execute --file prisma/apply-admin-sent-emails.sql)
CREATE TABLE IF NOT EXISTS "admin_sent_emails" (
    "id" SERIAL NOT NULL,
    "from_email" VARCHAR(255) NOT NULL,
    "from_name" VARCHAR(255),
    "to_emails" TEXT[] NOT NULL DEFAULT '{}',
    "cc_emails" TEXT[] NOT NULL DEFAULT '{}',
    "bcc_emails" TEXT[] NOT NULL DEFAULT '{}',
    "subject" VARCHAR(500) NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(6),
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sent_emails_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admin_sent_emails_created_by_id_idx" ON "admin_sent_emails"("created_by_id");
CREATE INDEX IF NOT EXISTS "admin_sent_emails_sent_at_idx" ON "admin_sent_emails"("sent_at");
CREATE INDEX IF NOT EXISTS "admin_sent_emails_status_idx" ON "admin_sent_emails"("status");
