-- Production readiness: isolate workspace/account data and scope integrations per client workspace.
DROP INDEX IF EXISTS "Integration_userId_platform_key";

-- Migrate platform connections into the user's existing primary workspace before
-- creating the workspace-scoped unique key. Legacy rows without a workspace remain
-- quarantined by application queries.
UPDATE "Integration" AS integration
SET "workspaceId" = member."workspaceId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "workspaceId"
  FROM "WorkspaceMember"
  ORDER BY "userId", "id"
) AS member
WHERE integration."workspaceId" IS NULL
  AND integration."userId" = member."userId";

CREATE UNIQUE INDEX "Integration_workspaceId_userId_platform_key" ON "Integration"("workspaceId", "userId", "platform");
CREATE INDEX "Integration_userId_platform_idx" ON "Integration"("userId", "platform");

ALTER TABLE "Creative" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Creative" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "Automation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Automation" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "Report" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "GeneratedCreative" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "AccountAudit" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "DailyBrief" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "CampaignPlan" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "ScheduledReport" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ScheduledReport" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "OptimizationLog" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "OptimizationLog" ADD COLUMN "adAccountId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "adAccountId" TEXT;

ALTER TABLE "Creative" ADD CONSTRAINT "Creative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OptimizationLog" ADD CONSTRAINT "OptimizationLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "DailyBrief_userId_workspaceId_briefDate_key";
CREATE UNIQUE INDEX "DailyBrief_userId_workspaceId_adAccountId_briefDate_key" ON "DailyBrief"("userId", "workspaceId", "adAccountId", "briefDate");

CREATE INDEX "Creative_workspaceId_idx" ON "Creative"("workspaceId");
CREATE INDEX "Creative_adAccountId_idx" ON "Creative"("adAccountId");
CREATE INDEX "Automation_workspaceId_idx" ON "Automation"("workspaceId");
CREATE INDEX "Automation_adAccountId_idx" ON "Automation"("adAccountId");
CREATE INDEX "Report_adAccountId_idx" ON "Report"("adAccountId");
CREATE INDEX "GeneratedCreative_adAccountId_idx" ON "GeneratedCreative"("adAccountId");
CREATE INDEX "AccountAudit_adAccountId_idx" ON "AccountAudit"("adAccountId");
CREATE INDEX "DailyBrief_adAccountId_briefDate_idx" ON "DailyBrief"("adAccountId", "briefDate");
CREATE INDEX "CampaignPlan_adAccountId_status_idx" ON "CampaignPlan"("adAccountId", "status");
CREATE INDEX "ActivityLog_adAccountId_createdAt_idx" ON "ActivityLog"("adAccountId", "createdAt");
CREATE INDEX "ScheduledReport_workspaceId_isActive_idx" ON "ScheduledReport"("workspaceId", "isActive");
CREATE INDEX "ScheduledReport_adAccountId_isActive_idx" ON "ScheduledReport"("adAccountId", "isActive");
CREATE INDEX "OptimizationLog_workspaceId_appliedAt_idx" ON "OptimizationLog"("workspaceId", "appliedAt");
CREATE INDEX "OptimizationLog_adAccountId_appliedAt_idx" ON "OptimizationLog"("adAccountId", "appliedAt");
CREATE INDEX "Lead_adAccountId_idx" ON "Lead"("adAccountId");
