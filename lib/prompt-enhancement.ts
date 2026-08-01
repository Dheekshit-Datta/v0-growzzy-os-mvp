function hasBudget(text: string) {
  return /(\$|₹|rs\.?|usd|inr|dollars?|rupees?|budget|per day|daily)/i.test(text)
}

function hasLocation(text: string) {
  return /(india|united states|usa|uk|united kingdom|canada|australia|london|delhi|mumbai|bangalore|new york|tier\s*1|city|cities|local)/i.test(text)
}

function hasAudience(text: string) {
  return /(women|men|owners?|students?|parents?|founders?|business|customers?|audience|aged?|age|b2b|b2c)/i.test(text)
}

function hasGoal(text: string) {
  return /(leads?|sales?|sell|traffic|bookings?|calls?|purchases?|signups?|conversions?)/i.test(text)
}

export function fallbackEnhancement(prompt: string) {
  const brief = prompt.trim().replace(/\s+/g, " ")
  const missing = [
    !hasGoal(brief) && "campaign goal",
    !hasAudience(brief) && "target audience",
    !hasLocation(brief) && "target location",
    !hasBudget(brief) && "daily budget",
  ].filter(Boolean)

  return [
    `Campaign brief: ${brief}`,
    `Launch direction: build the campaign around the offer described above, keeping the copy specific to that product or service and focused on the user's stated goal.`,
    missing.length
      ? `Missing before launch: add ${missing.join(", ")}.`
      : "Ready details detected: goal, audience, location, and budget are present in the brief.",
  ].join("\n\n")
}
