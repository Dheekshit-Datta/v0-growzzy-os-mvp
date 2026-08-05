ALTER TABLE "Workspace"
  ADD COLUMN "monthlyCredits" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "creditResetDay" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "usedCreditsThisMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditResetAt" TIMESTAMP(3);

CREATE TABLE "CreditUsageLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL,
  "costUsd" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditUsageLog_workspaceId_createdAt_idx" ON "CreditUsageLog"("workspaceId", "createdAt");
CREATE INDEX "CreditUsageLog_userId_createdAt_idx" ON "CreditUsageLog"("userId", "createdAt");
ALTER TABLE "CreditUsageLog" ADD CONSTRAINT "CreditUsageLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditUsageLog" ADD CONSTRAINT "CreditUsageLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
