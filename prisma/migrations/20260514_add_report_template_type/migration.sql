ALTER TABLE "ScheduledReport"
ADD COLUMN IF NOT EXISTS "templateType" TEXT NOT NULL DEFAULT 'monthly-performance';

