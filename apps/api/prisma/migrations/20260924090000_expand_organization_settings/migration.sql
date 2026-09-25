-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "notifyOnCertificateIssued" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "additionalPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "facebookPageName" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "enrollmentOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enrollmentNotice" TEXT DEFAULT 'Now Accepting Enrollees!',
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "invoiceDueDays" INTEGER,
ADD COLUMN     "receiptPrefix" TEXT NOT NULL DEFAULT 'RCPT',
ADD COLUMN     "certificatePrefix" TEXT NOT NULL DEFAULT 'CERT';
