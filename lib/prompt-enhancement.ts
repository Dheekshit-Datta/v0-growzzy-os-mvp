type EnhancementContext = {
  budget?: number | string | null
  location?: string | null
  goal?: string | null
}

function hasBudget(text: string, context?: EnhancementContext) {
  return Boolean(context?.budget) || /(\$|rs\.?|usd|inr|dollars?|rupees?|budget|per day|daily)/i.test(text)
}

function hasLocation(text: string, context?: EnhancementContext) {
  return Boolean(context?.location) || /(india|united states|usa|uk|united kingdom|canada|australia|london|delhi|mumbai|bangalore|new york|tier\s*1|city|cities|local)/i.test(text)
}

function hasAudience(text: string) {
  return /(women|men|owners?|students?|parents?|founders?|business|customers?|audience|aged?|age|b2b|b2c)/i.test(text)
}

function hasGoal(text: string, context?: EnhancementContext) {
  return Boolean(context?.goal) || /(leads?|sales?|sell|traffic|bookings?|calls?|purchases?|signups?|conversions?)/i.test(text)
}

export function fallbackEnhancement(prompt: string, context?: EnhancementContext) {
  const brief = prompt.trim().replace(/\s+/g, " ")
  const supplied = [
    context?.goal && `Goal: ${context.goal}`,
    context?.location && `Location: ${context.location}`,
    context?.budget && `Daily budget: $${context.budget}`,
  ].filter(Boolean)
  const missing = [
    !hasGoal(brief, context) && "campaign goal",
    !hasAudience(brief) && "target audience",
    !hasLocation(brief, context) && "target location",
    !hasBudget(brief, context) && "daily budget",
  ].filter(Boolean)

  return [
    `Campaign brief: ${brief}`,
    supplied.length ? `Confirmed launch inputs: ${supplied.join(" | ")}.` : "",
    `Launch direction: build the campaign around the offer described above, keeping the copy specific to that product or service and focused on the user's stated goal.`,
    missing.length
      ? `Missing before launch: add ${missing.join(", ")}.`
      : "Ready details detected: goal, audience, location, and budget are present.",
  ].filter(Boolean).join("\n\n")
}
