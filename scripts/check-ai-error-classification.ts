import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

for (const path of ["app/api/ai/enhance-prompt/route.ts", "app/api/ai/campaign-builder/route.ts"]) {
  const source = readFileSync(path, "utf8")
  assert.match(source, /lastFailure === "provider"/)
  assert.match(source, /code: "AI_UNAVAILABLE"/)
  assert.match(source, /code: "AI_INVALID_OUTPUT"/)
}

console.log("AI error classification checks passed")
