import { fallbackEnhancement } from "../lib/prompt-enhancement"

const prompt = "I want to sell artificial jewellery to women in Tier 1 cities of India with budget 1 dollar"
const enhanced = fallbackEnhancement(prompt)

if (enhanced.trim() === prompt.trim()) throw new Error("Fallback enhancement returned the unchanged prompt")
if (!enhanced.includes(prompt)) throw new Error("Fallback enhancement lost the original prompt")
if (!enhanced.includes("Ready details detected")) throw new Error("Fallback enhancement did not recognize supplied details")

console.log("Enhance fallback check passed")
