-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('freshman', 'senior', 'administrator', 'developer');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('email_verification', 'password_reset');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "handle" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'freshman',
    "semester" SMALLINT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'pending_verification',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "type" "TokenType" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "social_name" VARCHAR(60),
    "pronouns" VARCHAR(30),
    "tagline" VARCHAR(120),
    "biography_markdown" TEXT,
    "banner_url" VARCHAR(512),
    "banner_preset" VARCHAR(40),
    "theme_palette" JSONB,
    "social_links" JSONB,
    "contact_email" VARCHAR(255),
    "max_mentees" SMALLINT NOT NULL DEFAULT 3,
    "is_discoverable" BOOLEAN NOT NULL DEFAULT false,
    "is_accepting_requests" BOOLEAN NOT NULL DEFAULT true,
    "profile_views" INTEGER NOT NULL DEFAULT 0,
    "effort_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "icon" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_tags" (
    "profile_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("profile_id","tag_id")
);

-- CreateTable
CREATE TABLE "rich_cards" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "card_type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "subtitle" VARCHAR(150),
    "description" TEXT,
    "image_url" VARCHAR(512),
    "external_url" VARCHAR(512),
    "embed_url" VARCHAR(512),
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    "metadata" JSONB DEFAULT '{}',
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rich_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_entity" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(255),
    "details" JSONB DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role_status" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "idx_users_deleted" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_user_tokens_user_type" ON "user_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "idx_profiles_discoverable" ON "profiles"("is_discoverable");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "idx_tags_category" ON "tags"("category");

-- CreateIndex
CREATE INDEX "idx_rich_cards_profile" ON "rich_cards"("profile_id", "display_order");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rich_cards" ADD CONSTRAINT "rich_cards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

