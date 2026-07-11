-- Bulletproof AI media buyer trust layer
CREATE TABLE IF NOT EXISTS "DailyBrief" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT NOT NULL,
  "sourceAuditId" TEXT,
  "briefDate" TIMESTAMP(3) NOT NULL,
  "summary" TEXT NOT NULL,
  "accountHealth" JSONB NOT NULL,
  "moneyWasted" JSONB NOT NULL,
  "creativeFatigueAlerts" JSONB NOT NULL,
  "recommendations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignPlan" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'GOOGLE',
  "plan" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "launchedCampaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyBrief_userId_workspaceId_briefDate_key" ON "DailyBrief"("userId", "workspaceId", "briefDate");
CREATE INDEX IF NOT EXISTS "DailyBrief_workspaceId_briefDate_idx" ON "DailyBrief"("workspaceId", "briefDate");
CREATE INDEX IF NOT EXISTS "DailyBrief_userId_briefDate_idx" ON "DailyBrief"("userId", "briefDate");
CREATE INDEX IF NOT EXISTS "CampaignPlan_workspaceId_status_idx" ON "CampaignPlan"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "CampaignPlan_userId_createdAt_idx" ON "CampaignPlan"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_workspaceId_createdAt_idx" ON "ActivityLog"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "DailyBrief" ADD CONSTRAINT "DailyBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DailyBrief" ADD CONSTRAINT "DailyBrief_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CampaignPlan" ADD CONSTRAINT "CampaignPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CampaignPlan" ADD CONSTRAINT "CampaignPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL';
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "riskLevel" TEXT;
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "confidence" INTEGER;
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "actionPayload" JSONB;
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "undoPayload" JSONB;
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "undoneAt" TIMESTAMP(3);
ALTER TABLE "OptimizationLog" ADD COLUMN IF NOT EXISTS "error" TEXT;
