-- Scope campaign uniqueness to the connected integration/account instead of globally by platform.
-- Google/Meta campaign IDs can overlap across different ad accounts, so global uniqueness can leak
-- one account's campaign row into another account during sync upserts.
DROP INDEX IF EXISTS "Campaign_platform_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_integrationId_externalId_key" ON "Campaign"("integrationId", "externalId");
