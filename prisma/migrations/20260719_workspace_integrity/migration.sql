-- Keep existing workspaces while marking one canonical default per owner.
ALTER TABLE "Workspace" ADD COLUMN "defaultForOwnerId" TEXT;

WITH ranked_workspaces AS (
  SELECT
    "id",
    "ownerId",
    ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "Workspace"
)
UPDATE "Workspace" AS workspace
SET "defaultForOwnerId" = ranked."ownerId"
FROM ranked_workspaces AS ranked
WHERE workspace."id" = ranked."id" AND ranked.row_number = 1;

CREATE UNIQUE INDEX "Workspace_defaultForOwnerId_key" ON "Workspace"("defaultForOwnerId");

-- Scope existing notifications to each user's earliest workspace without deleting history.
ALTER TABLE "Notification" ADD COLUMN "workspaceId" TEXT;

WITH primary_memberships AS (
  SELECT DISTINCT ON (member."userId")
    member."userId",
    member."workspaceId"
  FROM "WorkspaceMember" AS member
  JOIN "Workspace" AS workspace ON workspace."id" = member."workspaceId"
  ORDER BY member."userId", workspace."createdAt" ASC, workspace."id" ASC
)
UPDATE "Notification" AS notification
SET "workspaceId" = membership."workspaceId"
FROM primary_memberships AS membership
WHERE notification."userId" = membership."userId";

CREATE INDEX "Notification_workspaceId_createdAt_idx" ON "Notification"("workspaceId", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
