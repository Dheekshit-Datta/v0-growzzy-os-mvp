import { fallbackGooglePlan } from "../app/api/ai/campaign-builder/route"

const plan = fallbackGooglePlan({
  platform: "GOOGLE",
  offer: "I want to sell artificial jewellery to women in Tier 1 cities of India",
  targetCustomer: "women in India",
  budget: 1,
  location: "India",
  goal: "LEADS",
})

if ((plan as any).platform !== undefined) throw new Error("Fallback should return raw model-like JSON, not validated output")
if (!Array.isArray(plan.adGroups) || plan.adGroups.length < 2) throw new Error("Fallback needs at least two ad groups")
if (plan.adGroups.some((group) => group.keywords.length < 10)) throw new Error("Fallback ad groups need enough keywords")
if (plan.adGroups.some((group) => group.descriptions.length < 2)) throw new Error("Fallback ad groups need enough descriptions")
if (!plan.locations.includes("India")) throw new Error("Fallback lost the requested location")

console.log("Campaign builder fallback check passed")
