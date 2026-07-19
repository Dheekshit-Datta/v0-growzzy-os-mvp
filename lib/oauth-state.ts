/**
 * CSRF state generation and verification for OAuth flows.
 * State is stored in a short-lived httpOnly cookie.
 */
import crypto from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const STATE_TTL_SECONDS = 600 // 10 minutes

export function generateState(): string {
    return crypto.randomBytes(24).toString("hex")
}

export function getStateCookieName(provider: string): string {
    return `oauth_state_${provider}`
}

export function stateMatches(incomingState: string | null, storedState: string | null): boolean {
    if (!incomingState || !storedState) return false
    if (Buffer.byteLength(incomingState, "utf8") !== Buffer.byteLength(storedState, "utf8")) return false
    return crypto.timingSafeEqual(Buffer.from(incomingState, "utf8"), Buffer.from(storedState, "utf8"))
}

/** Set a state cookie on the given response */
export function attachStateCookie(
    response: NextResponse,
    provider: string,
    state: string
): NextResponse {
    const name = getStateCookieName(provider)
    response.cookies.set(name, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: STATE_TTL_SECONDS,
        path: "/",
    })
    return response
}

/** Read and validate state from incoming request */
export async function verifyState(
    provider: string,
    incomingState: string | null
): Promise<boolean> {
    const cookieStore = await cookies()
    return stateMatches(incomingState, cookieStore.get(getStateCookieName(provider))?.value || null)
}

/** Clear the state cookie after callback */
export async function clearStateCookie(provider: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(getStateCookieName(provider))
}
