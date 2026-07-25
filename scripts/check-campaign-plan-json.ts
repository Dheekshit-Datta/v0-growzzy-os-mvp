import { parseJsonObject } from "../app/api/ai/campaign-builder/route"

console.assert(parseJsonObject('{"campaignName":"A"}').campaignName === "A")
console.assert(parseJsonObject('```json\n{"campaignName":"B"}\n```').campaignName === "B")

try {
  parseJsonObject("")
  throw new Error("empty response should fail")
} catch (error: any) {
  console.assert(error.message === "EMPTY_AI_RESPONSE")
}

console.log("campaign plan JSON parser checks passed")
