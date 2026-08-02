import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { aiErrorMetadata } from "../lib/ai-utility"

for (const path of ["app/api/ai/enhance-prompt/route.ts", "app/api/ai/campaign-builder/route.ts"]) {
  const source = readFileSync(path, "utf8")
  assert.match(source, /lastFailure === "provider"/)
  assert.match(source, /code: "AI_UNAVAILABLE"/)
  assert.match(source, /code: "AI_INVALID_OUTPUT"/)
}

assert.deepEqual(aiErrorMetadata({ status: 429, code: "insufficient_quota", type: "requests" }), {
  status: 429,
  code: "insufficient_quota",
  type: "requests",
})
assert.deepEqual(aiErrorMetadata(new Error("secret provider detail")), {
  status: null,
  code: null,
  type: "Error",
})

console.log("AI error classification checks passed")
