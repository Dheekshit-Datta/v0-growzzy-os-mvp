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
    if (!incomingState) return false
    const cookieStore = await cookies()
    const stored = cookieStore.get(getStateCookieName(provider))?.value
    if (!stored) return false
    if (Buffer.byteLength(incomingState, "utf8") !== Buffer.byteLength(stored, "utf8")) return false
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(incomingState, "utf8"),
        Buffer.from(stored, "utf8")
    )
}

/** Clear the state cookie after callback */
export async function clearStateCookie(provider: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(getStateCookieName(provider))
}
