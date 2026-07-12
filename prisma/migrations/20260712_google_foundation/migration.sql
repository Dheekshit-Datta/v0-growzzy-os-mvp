ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "dailyBudgetCeiling" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "defaultAutomationMode" TEXT NOT NULL DEFAULT 'ALERT',
  ADD COLUMN IF NOT EXISTS "targetCpa" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "maxDailyBudgetShiftPct" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "stopLossEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Integration"
  ADD COLUMN IF NOT EXISTS "accessTokenEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshTokenEncrypted" TEXT;

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "adAccountDbId" TEXT;

UPDATE "Campaign" AS campaign
SET "adAccountDbId" = account."id"
FROM "AdAccount" AS account
WHERE campaign."adAccountDbId" IS NULL
  AND campaign."integrationId" = account."integrationId"
  AND campaign."adAccountId" = account."externalId";

CREATE INDEX IF NOT EXISTS "Campaign_adAccountDbId_idx" ON "Campaign"("adAccountDbId");
CREATE INDEX IF NOT EXISTS "Campaign_adAccountId_idx" ON "Campaign"("adAccountId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Campaign_adAccountDbId_fkey') THEN
    ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountDbId_fkey"
      FOREIGN KEY ("adAccountDbId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CampaignPlan"
  ADD COLUMN IF NOT EXISTS "adAccountDbId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "externalCampaignId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignPlan_publishFingerprint_key" ON "CampaignPlan"("publishFingerprint");
CREATE INDEX IF NOT EXISTS "CampaignPlan_adAccountDbId_status_idx" ON "CampaignPlan"("adAccountDbId", "status");
CREATE INDEX IF NOT EXISTS "CampaignPlan_adAccountId_status_idx" ON "CampaignPlan"("adAccountId", "status");

UPDATE "CampaignPlan" AS plan
SET "adAccountDbId" = account."id"
FROM "AdAccount" AS account
WHERE plan."adAccountDbId" IS NULL
  AND plan."adAccountId" = account."externalId";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignPlan_adAccountDbId_fkey') THEN
    ALTER TABLE "CampaignPlan" ADD CONSTRAINT "CampaignPlan_adAccountDbId_fkey"
      FOREIGN KEY ("adAccountDbId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Signal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeExternalId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "explanation" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Signal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Signal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Signal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Signal_workspaceId_status_detectedAt_idx" ON "Signal"("workspaceId", "status", "detectedAt");
CREATE INDEX IF NOT EXISTS "Signal_campaignId_status_idx" ON "Signal"("campaignId", "status");

CREATE TABLE IF NOT EXISTS "OptimizationAction" (
  "id" TEXT NOT NULL,
  "signalId" TEXT,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "previousState" JSONB,
  "newState" JSONB,
  "outcomeSnapshot" JSONB,
  "executedAt" TIMESTAMP(3),
  "undoneAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OptimizationAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OptimizationAction_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OptimizationAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OptimizationAction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OptimizationAction_workspaceId_status_createdAt_idx" ON "OptimizationAction"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OptimizationAction_campaignId_createdAt_idx" ON "OptimizationAction"("campaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "OptimizationAction_signalId_idx" ON "OptimizationAction"("signalId");
