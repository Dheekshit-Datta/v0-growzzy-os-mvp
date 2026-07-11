export async function resolveUserId(sessionUserId: string): Promise<string> {
  if (!sessionUserId) throw new Error("Unauthorized")
  return sessionUserId
}
