ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "logo" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Workspace_ownerId_fkey'
  ) THEN
    ALTER TABLE "Workspace"
      ADD CONSTRAINT "Workspace_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "AdAccount" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "GeneratedCreative" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "GeneratedCreative" ADD COLUMN IF NOT EXISTS "score" INTEGER;
ALTER TABLE "GeneratedCreative" ADD COLUMN IF NOT EXISTS "scoreBreakdown" JSONB;
ALTER TABLE "GeneratedCreative" ADD COLUMN IF NOT EXISTS "variations" JSONB;
ALTER TABLE "AccountAudit" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "adSetId" TEXT;
ALTER TABLE "Ad" ALTER COLUMN "adGroupId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "AdSet" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "externalId" TEXT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ENABLED',
  "objective" TEXT,
  "targeting" JSONB,
  "placements" JSONB,
  "budgetAmount" DOUBLE PRECISION,
  "budgetType" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdAccount_workspaceId_idx" ON "AdAccount"("workspaceId");
CREATE INDEX IF NOT EXISTS "Integration_workspaceId_idx" ON "Integration"("workspaceId");
CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_idx" ON "Lead"("workspaceId");
CREATE INDEX IF NOT EXISTS "Report_workspaceId_idx" ON "Report"("workspaceId");
CREATE INDEX IF NOT EXISTS "GeneratedCreative_workspaceId_idx" ON "GeneratedCreative"("workspaceId");
CREATE INDEX IF NOT EXISTS "AccountAudit_workspaceId_idx" ON "AccountAudit"("workspaceId");
CREATE INDEX IF NOT EXISTS "AutomationRule_workspaceId_idx" ON "AutomationRule"("workspaceId");
CREATE INDEX IF NOT EXISTS "Ad_adSetId_idx" ON "Ad"("adSetId");
CREATE INDEX IF NOT EXISTS "AdSet_workspaceId_idx" ON "AdSet"("workspaceId");
CREATE INDEX IF NOT EXISTS "AdSet_campaignId_idx" ON "AdSet"("campaignId");
CREATE INDEX IF NOT EXISTS "AdSet_userId_idx" ON "AdSet"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AdAccount_workspaceId_fkey') THEN
    ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Integration_workspaceId_fkey') THEN
    ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Campaign_workspaceId_fkey') THEN
    ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Lead_workspaceId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Report_workspaceId_fkey') THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'GeneratedCreative_workspaceId_fkey') THEN
    ALTER TABLE "GeneratedCreative" ADD CONSTRAINT "GeneratedCreative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AccountAudit_workspaceId_fkey') THEN
    ALTER TABLE "AccountAudit" ADD CONSTRAINT "AccountAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AutomationRule_workspaceId_fkey') THEN
    ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AdSet_workspaceId_fkey') THEN
    ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AdSet_campaignId_fkey') THEN
    ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AdSet_userId_fkey') THEN
    ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Ad_adSetId_fkey') THEN
    ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
