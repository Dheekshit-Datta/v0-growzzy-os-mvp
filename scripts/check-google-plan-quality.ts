import { assessGoogleSearchPlan, parseGoogleSearchPlan } from "../lib/google-plan-quality"

const goodPlan = {
  platform: "GOOGLE",
  campaignType: "SEARCH",
  objective: "LEADS",
  campaignName: "Artificial Jewellery Search",
  biddingStrategy: "MAXIMIZE_CLICKS",
  dailyBudget: 10,
  finalUrl: "https://shop.example.org/jewellery",
  locations: ["India"],
  languages: ["English"],
  rationale: {
    whyThisStructure: "Separates bridal shoppers from everyday jewellery shoppers.",
    whyTheseKeywords: "Uses product-specific searches with clear buying intent.",
    whyThisBidding: "Starts with click acquisition while conversion history is limited.",
    expectedResultsRange: "Results depend on auction demand and landing-page conversion.",
  },
  landingPageSuggestions: [],
  launchReadinessScore: 80,
  risks: [],
  adGroups: ["Bridal Jewellery", "Everyday Jewellery"].map((name, groupIndex) => ({
    name,
    theme: groupIndex ? "Everyday artificial jewellery" : "Artificial bridal jewellery",
    keywords: Array.from({ length: 10 }, (_, index) => ({ text: `${groupIndex ? "everyday" : "bridal"} artificial jewellery ${index + 1}`, matchType: index % 2 ? "EXACT" : "PHRASE" })),
    negativeKeywords: ["free", "jobs", "wholesale", "repair", "course"],
    headlines: Array.from({ length: 8 }, (_, index) => `${groupIndex ? "Everyday" : "Bridal"} Jewellery ${index + 1}`.slice(0, 30)),
    descriptions: [
      `Shop ${name.toLowerCase()} designed for modern Indian celebrations.`,
      "Explore clear product details and choose the style that fits your occasion.",
      "Browse the collection online and order when you are ready.",
    ],
  })),
}

const good = parseGoogleSearchPlan(goodPlan)
if (!good.plan || good.quality?.status !== "PASS") throw new Error(`Expected a valid plan: ${good.error || JSON.stringify(good.quality)}`)

const leaked = structuredClone(goodPlan)
leaked.adGroups[0].headlines[0] = "Campaign brief: buy now"
if (assessGoogleSearchPlan(leaked).status !== "FAIL") throw new Error("Internal fallback copy was not rejected")

// Within-group duplicate keyword test
const duplicateWithin = structuredClone(goodPlan)
duplicateWithin.adGroups[0].keywords[1].text = duplicateWithin.adGroups[0].keywords[0].text
if (assessGoogleSearchPlan(duplicateWithin).status !== "FAIL") throw new Error("Duplicate keywords within group were not rejected")

// Cross-ad-group duplicate keyword test
const duplicateCross = structuredClone(goodPlan)
duplicateCross.adGroups[1].keywords[0].text = duplicateCross.adGroups[0].keywords[0].text
const crossResult = assessGoogleSearchPlan(duplicateCross)
if (crossResult.status !== "FAIL" || !crossResult.errors.some(e => e.includes("duplicated across") || e.includes("appears in both"))) {
  throw new Error("Cross-ad-group duplicate keywords were not rejected")
}

// TARGET_ROAS rejection test
const roasPlan = structuredClone(goodPlan)
;(roasPlan as any).biddingStrategy = "TARGET_ROAS"
if (parseGoogleSearchPlan(roasPlan).plan) throw new Error("TARGET_ROAS was not rejected on day-one search plan")

const placeholder = { ...goodPlan, finalUrl: "https://example.com" }
if (assessGoogleSearchPlan(placeholder, { requireFinalUrl: true }).status !== "FAIL") throw new Error("Placeholder URL was not rejected")

console.log("All Google plan quality & deduplication checks passed successfully!")

