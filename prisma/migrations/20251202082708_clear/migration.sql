-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'COMPLIANCE', 'ENGINEER', 'TEST');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('READ_USERS', 'SUSPEND_USERS', 'READ_TRANSACTIONS', 'VERIFY_TRANSACTIONS', 'READ_TX_HASH', 'READ_WALLETS', 'FREEZE_WALLETS', 'READ_AUDIT_LOGS', 'VERIFY_KYC');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "profile" VARCHAR(255),
    "departmentId" INTEGER,
    "role" "AdminRole" NOT NULL DEFAULT 'ENGINEER',
    "roleId" INTEGER,
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "password" VARCHAR(255) NOT NULL,
    "passwordSet" BOOLEAN NOT NULL DEFAULT false,
    "lastPasswordChangeAt" TIMESTAMP(6),
    "lastLoginAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER,
    "actorId" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" INTEGER NOT NULL,
    "lastUpdatedById" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permission" "Permission" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_user_names" (
    "id" SERIAL NOT NULL,
    "apple_id" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "full_name" VARCHAR(512),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_user_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "azer_auth_token" (
    "token_id" SERIAL NOT NULL,
    "useremail" VARCHAR(200),
    "token" VARCHAR(200),
    "created_at" VARCHAR(200),
    "expire_at" VARCHAR(200),
    "track_code" VARCHAR(200),
    "device" VARCHAR(200),

    CONSTRAINT "azer_auth_token_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "azer_bnb_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_bnb_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_btc_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_btc_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_eth_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_eth_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_hash" (
    "hash_id" SERIAL NOT NULL,
    "hash" VARCHAR(200),
    "token" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" VARCHAR(200),

    CONSTRAINT "azer_hash_pkey" PRIMARY KEY ("hash_id")
);

-- CreateTable
CREATE TABLE "azer_ltc_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_ltc_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_password_recovery" (
    "pr_id" SERIAL NOT NULL,
    "useremail" VARCHAR(200),
    "token" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "expire_at" VARCHAR(200),
    "device" VARCHAR(200),
    "track_code" VARCHAR(200),
    "date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_password_recovery_pkey" PRIMARY KEY ("pr_id")
);

-- CreateTable
CREATE TABLE "azer_pol_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_pol_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_sol_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_sol_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_trx_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_trx_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_usdc_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_usdc_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "azer_usdt_wallet" (
    "wallet_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(200),
    "user_api_key" VARCHAR(200),
    "client_secret_key" VARCHAR(200),
    "hash" VARCHAR(200),
    "created_at" VARCHAR(200),
    "trackcode" VARCHAR(200),
    "seed" VARCHAR(200),
    "date" VARCHAR(200),
    "device" VARCHAR(200),
    "total_balance" DOUBLE PRECISION,
    "withdrawable_limit" DOUBLE PRECISION,
    "locked_amount" DOUBLE PRECISION,
    "a" DOUBLE PRECISION,
    "b" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "network" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "azer_usdt_wallet_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "bank_account" (
    "bank_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(200),
    "keychain" VARCHAR(200),
    "country" VARCHAR(200),
    "currency_iso3" VARCHAR(200),
    "bank_name" VARCHAR(200),
    "bank_account" VARCHAR(200),
    "bank_account_name" VARCHAR(200),
    "set_default" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_account_pkey" PRIMARY KEY ("bank_id")
);

-- CreateTable
CREATE TABLE "bank_list" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "country" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_network" (
    "net_id" SERIAL NOT NULL,
    "symbol" VARCHAR(200),
    "network_full_name" VARCHAR(200),
    "network_id" VARCHAR(200),
    "network_type" VARCHAR(200),
    "network_logo" VARCHAR(200),
    "keychain" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_network_pkey" PRIMARY KEY ("net_id")
);

-- CreateTable
CREATE TABLE "currency" (
    "currency_id" SERIAL NOT NULL,
    "currency_name" VARCHAR(200),
    "country_code_iso2" VARCHAR(200),
    "currency_init" VARCHAR(200),
    "country" VARCHAR(200),
    "image" VARCHAR(200),
    "selling_rate" VARCHAR(200),
    "market_rate" VARCHAR(200),
    "buying_rate" VARCHAR(200),
    "currency_sign" VARCHAR(200),
    "creator_user_id" INTEGER,
    "key_chain" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flag" VARCHAR(200),
    "flag_emoji" VARCHAR(200),
    "flag_emojiu" VARCHAR(200),

    CONSTRAINT "currency_pkey" PRIMARY KEY ("currency_id")
);

-- CreateTable
CREATE TABLE "email_oauth" (
    "oauth_id" SERIAL NOT NULL,
    "oauthcode" VARCHAR(200),
    "created_at" VARCHAR(200),
    "expire_at" VARCHAR(200),
    "useremail" VARCHAR(200),
    "date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keychain" VARCHAR(200),
    "hash" VARCHAR(200),
    "device" VARCHAR(200),
    "verified" BOOLEAN DEFAULT false,

    CONSTRAINT "email_oauth_pkey" PRIMARY KEY ("oauth_id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "m_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(255) NOT NULL,
    "user_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "bank_name" VARCHAR(100) NOT NULL,
    "bank_account_name" VARCHAR(150) NOT NULL,
    "bank_account_number" VARCHAR(50) NOT NULL,
    "bank_code" VARCHAR(20),
    "verification_status" VARCHAR(20) DEFAULT 'pending',
    "verification_date" BIGINT,
    "verified_by_admin" VARCHAR(255),
    "verification_notes" TEXT,
    "total_order" INTEGER DEFAULT 0,
    "completed_order" INTEGER DEFAULT 0,
    "pending_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "keychain" VARCHAR(8) NOT NULL,
    "ip_address" VARCHAR(45),
    "device" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("m_id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "otp_code" VARCHAR(6) NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "auth_hash" VARCHAR(100),
    "verified" BOOLEAN DEFAULT false,
    "created_at" BIGINT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "hash_expires_at" BIGINT,
    "device" TEXT,
    "used" BOOLEAN DEFAULT false,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verify" (
    "oauth_id" SERIAL NOT NULL,
    "oauthcode" VARCHAR(200),
    "created_at" VARCHAR(200),
    "created_for" VARCHAR(200),
    "expire_at" VARCHAR(200),
    "useremail" VARCHAR(200),
    "date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keychain" VARCHAR(200),
    "hash" VARCHAR(200),
    "device" VARCHAR(200),

    CONSTRAINT "otp_verify_pkey" PRIMARY KEY ("oauth_id")
);

-- CreateTable
CREATE TABLE "pin_auth" (
    "pin_auth_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(200),
    "pin_auth_hash" VARCHAR(200),
    "keychain" VARCHAR(200),
    "token" VARCHAR(200),
    "device" VARCHAR(200),
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pin_auth_pkey" PRIMARY KEY ("pin_auth_id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "recipient_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "network" VARCHAR(50) NOT NULL,
    "asset" VARCHAR(20) NOT NULL,
    "wallet_address" VARCHAR(255) NOT NULL,
    "keychain" VARCHAR(8) NOT NULL,
    "ip_address" VARCHAR(45),
    "device" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("recipient_id")
);

-- CreateTable
CREATE TABLE "send_coin_user" (
    "azer_id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "user_email" TEXT,
    "password" TEXT,
    "verify_user" BOOLEAN,
    "live_secret_key" TEXT,
    "live_public_key" TEXT,
    "test_public_key" TEXT,
    "test_webhook_key" TEXT,
    "api_key" TEXT,
    "device" TEXT,
    "ip_addr" TEXT,
    "logincount" VARCHAR(200) NOT NULL DEFAULT '0',
    "profession" TEXT,
    "offeredsolution" VARCHAR(200),
    "solutiontype" VARCHAR(200),
    "country" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "device_security" VARCHAR(11) NOT NULL DEFAULT 'off',
    "vibrate" VARCHAR(11) NOT NULL DEFAULT 'off',
    "sound" VARCHAR(11) NOT NULL DEFAULT 'off',
    "activity_notify" VARCHAR(11) DEFAULT 'off',
    "default_currency" VARCHAR(200) DEFAULT 'usd',
    "address" TEXT,
    "linkedin" TEXT,
    "facebook" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "github" TEXT,
    "profile_pix" TEXT,
    "webite" TEXT,
    "company_logo" TEXT,
    "company_name" TEXT,
    "company_verify" VARCHAR(200) NOT NULL DEFAULT '0',
    "country_iso2" VARCHAR(200),
    "account_ban" VARCHAR(200) NOT NULL DEFAULT 'false',
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referal_id" VARCHAR(200),
    "referee" VARCHAR(200),
    "google_id" VARCHAR(255),
    "oauth_provider" VARCHAR(50),
    "apple_id" VARCHAR(255),
    "apple_verified" BOOLEAN DEFAULT false,
    "is_private_email" BOOLEAN DEFAULT false,
    "auth_provider" VARCHAR(50) DEFAULT 'email',
    "last_login_ip" VARCHAR(45),
    "last_login_location" VARCHAR(255),
    "last_login_at" TIMESTAMP(6),

    CONSTRAINT "send_coin_user_pkey" PRIMARY KEY ("azer_id")
);

-- CreateTable
CREATE TABLE "survey_config" (
    "config_id" SERIAL NOT NULL,
    "survey_title" VARCHAR(255) NOT NULL,
    "survey_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "show_on_signup" BOOLEAN NOT NULL DEFAULT true,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "survey_config_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "question_id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" VARCHAR(50) NOT NULL DEFAULT 'text',
    "question_options" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "question_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "survey_sessions" (
    "session_id" SERIAL NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "azer_id" INTEGER,
    "config_id" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "ip_address" INET,

    CONSTRAINT "survey_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "transaction_history" (
    "history_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(255) NOT NULL,
    "merchant_keychain" VARCHAR(8),
    "reference" VARCHAR(36) NOT NULL,
    "keychain" VARCHAR(16) NOT NULL,
    "asset_type" VARCHAR(10) NOT NULL,
    "option_type" VARCHAR(10) NOT NULL,
    "transaction_type" VARCHAR(10) NOT NULL,
    "crypto_sign" VARCHAR(10),
    "crypto_amount" DECIMAL(20,8),
    "crypto_unit" DECIMAL(20,8),
    "network" VARCHAR(50),
    "currency_sign" VARCHAR(10),
    "currency_amount" DECIMAL(20,2),
    "exchange_rate" DECIMAL(20,4),
    "buying_rate" DECIMAL(20,4),
    "selling_rate" DECIMAL(20,4),
    "payment_method" VARCHAR(30),
    "status" VARCHAR(20) DEFAULT 'pending',
    "status_updated_by" VARCHAR(255),
    "status_updated_at" BIGINT,
    "status_notes" TEXT,
    "payment_proof_url" TEXT,
    "payment_proof_uploaded_at" BIGINT,
    "merchant_bank_name" VARCHAR(100),
    "merchant_bank_account" VARCHAR(50),
    "merchant_account_name" VARCHAR(150),
    "ip_address" VARCHAR(45),
    "device" TEXT,
    "location" VARCHAR(255),
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_api_key" VARCHAR(255) NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "notification_type" VARCHAR(50) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "priority" VARCHAR(20) DEFAULT 'normal',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "is_read" BOOLEAN DEFAULT false,
    "read_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "device" TEXT,
    "location" VARCHAR(255),
    "archived" BOOLEAN DEFAULT false,
    "archived_at" BIGINT,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "user_survey_responses" (
    "response_id" SERIAL NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "azer_id" INTEGER,
    "config_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_text" TEXT,
    "answer_numeric" DECIMAL(10,2),
    "answer_boolean" BOOLEAN,
    "answer_date" TIMESTAMP(6),
    "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "user_survey_responses_pkey" PRIMARY KEY ("response_id")
);

-- CreateTable
CREATE TABLE "wallet_transfers" (
    "transfer_id" SERIAL NOT NULL,
    "reference" VARCHAR(36) NOT NULL,
    "user_api_key" VARCHAR(255) NOT NULL,
    "recipient_keychain" VARCHAR(8),
    "recipient_name" VARCHAR(120),
    "recipient_wallet_address" VARCHAR(255) NOT NULL,
    "asset" VARCHAR(20) NOT NULL,
    "network" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(28,8) NOT NULL,
    "fee" DECIMAL(28,8),
    "status" VARCHAR(20) DEFAULT 'pending',
    "tx_hash" VARCHAR(120),
    "note" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "device" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,
    "created_at_timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transfers_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "apple_user_names_apple_id_key" ON "apple_user_names"("apple_id");

-- CreateIndex
CREATE INDEX "idx_apple_user_names_apple_id" ON "apple_user_names"("apple_id");

-- CreateIndex
CREATE INDEX "idx_azer_auth_token_expire_at" ON "azer_auth_token"("expire_at");

-- CreateIndex
CREATE INDEX "idx_azer_auth_token_token" ON "azer_auth_token"("token");

-- CreateIndex
CREATE INDEX "idx_azer_auth_token_track_code" ON "azer_auth_token"("track_code");

-- CreateIndex
CREATE INDEX "idx_azer_auth_token_useremail" ON "azer_auth_token"("useremail");

-- CreateIndex
CREATE INDEX "idx_azer_password_recovery_expire_at" ON "azer_password_recovery"("expire_at");

-- CreateIndex
CREATE INDEX "idx_azer_password_recovery_hash" ON "azer_password_recovery"("hash");

-- CreateIndex
CREATE INDEX "idx_azer_password_recovery_token" ON "azer_password_recovery"("token");

-- CreateIndex
CREATE INDEX "idx_azer_password_recovery_track_code" ON "azer_password_recovery"("track_code");

-- CreateIndex
CREATE INDEX "idx_azer_password_recovery_useremail" ON "azer_password_recovery"("useremail");

-- CreateIndex
CREATE INDEX "idx_email_oauth_oauthcode" ON "email_oauth"("oauthcode");

-- CreateIndex
CREATE INDEX "idx_email_oauth_useremail" ON "email_oauth"("useremail");

-- CreateIndex
CREATE INDEX "idx_email_oauth_verification" ON "email_oauth"("useremail", "oauthcode", "verified");

-- CreateIndex
CREATE INDEX "idx_email_oauth_verified" ON "email_oauth"("useremail", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_user_api_key_key" ON "merchants"("user_api_key");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_keychain_key" ON "merchants"("keychain");

-- CreateIndex
CREATE INDEX "idx_merchants_active_verified" ON "merchants"("is_active", "verification_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_merchants_created_at" ON "merchants"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_merchants_email" ON "merchants"("email");

-- CreateIndex
CREATE INDEX "idx_merchants_is_active" ON "merchants"("is_active");

-- CreateIndex
CREATE INDEX "idx_merchants_keychain" ON "merchants"("keychain");

-- CreateIndex
CREATE INDEX "idx_merchants_user_api_key" ON "merchants"("user_api_key");

-- CreateIndex
CREATE INDEX "idx_merchants_verification_status" ON "merchants"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "otp_verifications_auth_hash_key" ON "otp_verifications"("auth_hash");

-- CreateIndex
CREATE INDEX "idx_otp_auth_hash" ON "otp_verifications"("auth_hash");

-- CreateIndex
CREATE INDEX "idx_otp_email_purpose" ON "otp_verifications"("email", "purpose");

-- CreateIndex
CREATE INDEX "idx_otp_email_verified" ON "otp_verifications"("email", "verified");

-- CreateIndex
CREATE INDEX "idx_otp_expires_at" ON "otp_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "idx_otp_lookup" ON "otp_verifications"("email", "otp_code", "purpose", "verified");

-- CreateIndex
CREATE INDEX "idx_otp_verify_created_for" ON "otp_verify"("created_for");

-- CreateIndex
CREATE INDEX "idx_otp_verify_expire_at" ON "otp_verify"("expire_at");

-- CreateIndex
CREATE INDEX "idx_otp_verify_hash" ON "otp_verify"("hash");

-- CreateIndex
CREATE INDEX "idx_otp_verify_keychain" ON "otp_verify"("keychain");

-- CreateIndex
CREATE INDEX "idx_otp_verify_oauthcode" ON "otp_verify"("oauthcode");

-- CreateIndex
CREATE INDEX "idx_otp_verify_useremail" ON "otp_verify"("useremail");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_keychain_key" ON "recipients"("keychain");

-- CreateIndex
CREATE INDEX "idx_recipients_keychain" ON "recipients"("keychain");

-- CreateIndex
CREATE INDEX "idx_recipients_user_api_key" ON "recipients"("user_api_key", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_recipient" ON "recipients"("user_api_key", "wallet_address", "network", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "send_coin_user_user_email_key" ON "send_coin_user"("user_email");

-- CreateIndex
CREATE UNIQUE INDEX "send_coin_user_apple_id_key" ON "send_coin_user"("apple_id");

-- CreateIndex
CREATE INDEX "idx_apple_id" ON "send_coin_user"("apple_id");

-- CreateIndex
CREATE INDEX "idx_google_id" ON "send_coin_user"("google_id");

-- CreateIndex
CREATE INDEX "idx_send_coin_user_email_ip" ON "send_coin_user"("user_email", "last_login_ip");

-- CreateIndex
CREATE INDEX "idx_send_coin_user_last_login_ip" ON "send_coin_user"("last_login_ip");

-- CreateIndex
CREATE INDEX "idx_survey_config_active" ON "survey_config"("is_active", "show_on_signup");

-- CreateIndex
CREATE INDEX "idx_survey_questions_config" ON "survey_questions"("config_id", "question_order");

-- CreateIndex
CREATE INDEX "idx_survey_sessions_completed" ON "survey_sessions"("is_completed");

-- CreateIndex
CREATE INDEX "idx_survey_sessions_email" ON "survey_sessions"("user_email");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_history_reference_key" ON "transaction_history"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_history_keychain_key" ON "transaction_history"("keychain");

-- CreateIndex
CREATE INDEX "idx_transactions_asset_type" ON "transaction_history"("asset_type");

-- CreateIndex
CREATE INDEX "idx_transactions_created_at" ON "transaction_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_crypto_sign" ON "transaction_history"("crypto_sign");

-- CreateIndex
CREATE INDEX "idx_transactions_filters" ON "transaction_history"("user_api_key", "asset_type", "option_type", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_keychain" ON "transaction_history"("keychain");

-- CreateIndex
CREATE INDEX "idx_transactions_merchant_keychain" ON "transaction_history"("merchant_keychain");

-- CreateIndex
CREATE INDEX "idx_transactions_merchant_status" ON "transaction_history"("merchant_keychain", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_option_type" ON "transaction_history"("option_type");

-- CreateIndex
CREATE INDEX "idx_transactions_reference" ON "transaction_history"("reference");

-- CreateIndex
CREATE INDEX "idx_transactions_status" ON "transaction_history"("status");

-- CreateIndex
CREATE INDEX "idx_transactions_user_api_key" ON "transaction_history"("user_api_key");

-- CreateIndex
CREATE INDEX "idx_transactions_user_asset" ON "transaction_history"("user_api_key", "asset_type", "crypto_sign", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_user_status" ON "transaction_history"("user_api_key", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_archived" ON "user_notifications"("user_api_key", "archived", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_created_at" ON "user_notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_metadata" ON "user_notifications" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "idx_notifications_type" ON "user_notifications"("notification_type");

-- CreateIndex
CREATE INDEX "idx_notifications_user_category" ON "user_notifications"("user_api_key", "category", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_user_status" ON "user_notifications"("user_api_key", "is_read", "archived", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_user_unread" ON "user_notifications"("user_api_key", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_user_responses_config" ON "user_survey_responses"("config_id");

-- CreateIndex
CREATE INDEX "idx_user_responses_email" ON "user_survey_responses"("user_email");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transfers_reference_key" ON "wallet_transfers"("reference");

-- CreateIndex
CREATE INDEX "idx_wallet_transfers_reference" ON "wallet_transfers"("reference");

-- CreateIndex
CREATE INDEX "idx_wallet_transfers_status" ON "wallet_transfers"("status");

-- CreateIndex
CREATE INDEX "idx_wallet_transfers_user" ON "wallet_transfers"("user_api_key", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "survey_config"("config_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "survey_sessions" ADD CONSTRAINT "survey_sessions_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "survey_config"("config_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_history" ADD CONSTRAINT "fk_merchant_keychain" FOREIGN KEY ("merchant_keychain") REFERENCES "merchants"("keychain") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_survey_responses" ADD CONSTRAINT "user_survey_responses_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "survey_config"("config_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_survey_responses" ADD CONSTRAINT "user_survey_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION;
