import assert from "node:assert/strict"
import { formatBusinessContext } from "../lib/business-context"

const context = formatBusinessContext({ name: "Acme", productDescription: "Accounting for freelancers.", toneOfVoice: "Warm", primaryGoal: "LEADS" })
assert.match(context, /Accounting for freelancers/)
assert.match(context, /Preferred voice: Warm/)
assert.equal(formatBusinessContext(null), "")

console.log("Business context formatting passed")
