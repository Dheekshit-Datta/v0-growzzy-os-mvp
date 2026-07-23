import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const utilityFiles = [
  "app/api/ai/audit/route.ts",
  "app/api/ai/chat/route.ts",
  "app/api/ai/daily-brief/route.ts",
  "app/api/ai/suggest-keywords/route.ts",
  "app/api/leads/[id]/score/route.ts",
  "lib/services/policy-check.ts",
  "lib/report-template-renderer.ts",
]

for (const file of utilityFiles) {
  assert.match(readFileSync(file, "utf8"), /model:\s*UTILITY_MODEL/, `${file} must use UTILITY_MODEL`)
}

assert.match(readFileSync("app/api/ai/campaign-builder/route.ts", "utf8"), /OPENAI_CAMPAIGN_BUILDER_MODEL/)
assert.match(readFileSync("app/api/ai/generate-creatives/route.ts", "utf8"), /OPENAI_IMAGE_MODEL/)
assert.match(readFileSync("lib/openai-service.ts", "utf8"), /model:\s*process\.env\.OPENAI_CREATIVE_MODEL/)

console.log("AI model-routing checks passed")
