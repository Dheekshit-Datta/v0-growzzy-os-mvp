import assert from "node:assert/strict"
import { utilityCacheKey } from "../lib/ai-utility"

const input = { prompt: "private campaign brief", nested: { goal: "LEADS" } }
const first = utilityCacheKey("enhance", "workspace-a", input)

assert.equal(first, utilityCacheKey("enhance", "workspace-a", input))
assert.notEqual(first, utilityCacheKey("enhance", "workspace-b", input))
assert(!first.includes(input.prompt), "cache key must not expose prompt content")
console.log("AI utility cache-key checks passed")
