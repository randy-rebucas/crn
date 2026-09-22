-- CreateEnum
CREATE TYPE "RequirementSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_submissions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" "RequirementSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "filePath" TEXT,
    "fileMimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirements_organizationId_idx" ON "requirements"("organizationId");

-- CreateIndex
CREATE INDEX "requirements_programId_idx" ON "requirements"("programId");

-- CreateIndex
CREATE INDEX "requirement_submissions_enrollmentId_idx" ON "requirement_submissions"("enrollmentId");

-- CreateIndex
CREATE INDEX "requirement_submissions_requirementId_idx" ON "requirement_submissions"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_submissions_enrollmentId_requirementId_key" ON "requirement_submissions"("enrollmentId", "requirementId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_submissions" ADD CONSTRAINT "requirement_submissions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_submissions" ADD CONSTRAINT "requirement_submissions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_submissions" ADD CONSTRAINT "requirement_submissions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

