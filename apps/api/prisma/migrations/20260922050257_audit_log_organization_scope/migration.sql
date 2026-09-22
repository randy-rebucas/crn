-- AlterTable: add organizationId as nullable first so existing rows can be
-- backfilled before the NOT NULL constraint is enforced.
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" TEXT;

-- Backfill from the acting user's organization where we have one.
UPDATE "audit_logs" AS a
SET "organizationId" = u."organizationId"
FROM "users" AS u
WHERE a."actorId" = u.id;

-- Any remaining rows (no actor, e.g. an unauthenticated event, or an actor
-- that no longer resolves) have nothing to derive an organization from.
-- This dev/staging database has exactly one organization, so backfill the
-- rest to it; a genuinely multi-tenant deployment reaching this migration
-- with ambiguous orphaned rows would need to decide this per-row instead.
UPDATE "audit_logs"
SET "organizationId" = (SELECT id FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;

ALTER TABLE "audit_logs" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");
