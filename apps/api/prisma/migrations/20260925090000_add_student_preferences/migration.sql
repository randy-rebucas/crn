-- CreateTable
CREATE TABLE "student_preferences" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "notifySchedule" BOOLEAN NOT NULL DEFAULT true,
    "notifyExams" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "notifyPayments" BOOLEAN NOT NULL DEFAULT true,
    "notifyCertificates" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "classReminderMinutes" INTEGER DEFAULT 60,
    "studyReminderTime" TEXT,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "allowSuccessStory" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_preferences_studentProfileId_key" ON "student_preferences"("studentProfileId");

-- CreateIndex
CREATE INDEX "student_preferences_organizationId_idx" ON "student_preferences"("organizationId");

-- AddForeignKey
ALTER TABLE "student_preferences" ADD CONSTRAINT "student_preferences_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

