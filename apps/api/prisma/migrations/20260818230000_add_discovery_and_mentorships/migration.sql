-- CreateEnum
CREATE TYPE "MentorshipRequestStatus" AS ENUM ('pending', 'pending_admin_approval', 'accepted', 'rejected', 'cancelled', 'cancelled_capacity_filled');

-- CreateTable
CREATE TABLE "profile_bumps" (
    "freshman_id" UUID NOT NULL,
    "senior_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_bumps_pkey" PRIMARY KEY ("freshman_id","senior_id")
);

-- CreateTable
CREATE TABLE "mentorship_requests" (
    "id" UUID NOT NULL,
    "freshman_id" UUID NOT NULL,
    "senior_id" UUID NOT NULL,
    "status" "MentorshipRequestStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "reviewed_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mentorship_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorships" (
    "id" UUID NOT NULL,
    "request_id" UUID,
    "freshman_id" UUID NOT NULL,
    "senior_id" UUID NOT NULL,
    "semester" SMALLINT NOT NULL,
    "academic_year" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_profile_bumps_senior" ON "profile_bumps"("senior_id");

-- CreateIndex
CREATE INDEX "idx_mentorship_requests_senior" ON "mentorship_requests"("senior_id", "status");

-- CreateIndex
CREATE INDEX "idx_mentorship_requests_freshman" ON "mentorship_requests"("freshman_id", "status");

-- CreateIndex
CREATE INDEX "idx_mentorship_requests_status" ON "mentorship_requests"("status");

-- Partial unique index: only one active application per pair at a time,
-- while still allowing rejected/cancelled requests to be re-applied later.
CREATE UNIQUE INDEX "unique_active_request" ON "mentorship_requests"("freshman_id", "senior_id") WHERE status IN ('pending', 'pending_admin_approval', 'accepted');

-- CreateIndex
CREATE UNIQUE INDEX "idx_mentorships_pair" ON "mentorships"("freshman_id", "senior_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentorships_request_id_key" ON "mentorships"("request_id");

-- CreateIndex
CREATE INDEX "idx_mentorships_senior" ON "mentorships"("senior_id");

-- CreateIndex
CREATE INDEX "idx_mentorships_freshman" ON "mentorships"("freshman_id");

-- AddForeignKey
ALTER TABLE "profile_bumps" ADD CONSTRAINT "profile_bumps_freshman_id_fkey" FOREIGN KEY ("freshman_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_bumps" ADD CONSTRAINT "profile_bumps_senior_id_fkey" FOREIGN KEY ("senior_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_freshman_id_fkey" FOREIGN KEY ("freshman_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_senior_id_fkey" FOREIGN KEY ("senior_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "mentorship_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_freshman_id_fkey" FOREIGN KEY ("freshman_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_senior_id_fkey" FOREIGN KEY ("senior_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;