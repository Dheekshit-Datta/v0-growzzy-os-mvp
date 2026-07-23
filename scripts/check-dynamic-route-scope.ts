import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const leadRoute = readFileSync("app/api/leads/[id]/route.ts", "utf8")
assert.match(leadRoute, /id: body\.campaignId, userId, workspaceId, adAccountId: accountScope\.adAccountId/)
assert.match(leadRoute, /if \(!campaign\).*Campaign not found/)

console.log("Dynamic relation-scope checks passed")
