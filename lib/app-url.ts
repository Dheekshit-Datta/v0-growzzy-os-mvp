/**
 * Resolve the canonical app origin for OAuth and absolute redirect URIs.
 *
 * Order of precedence:
 *   1. NEXTAUTH_URL — the canonical public URL Google sees. Use this whenever
 *      the registered OAuth redirect URI must match, otherwise Google rejects
 *      the handshake with redirect_uri_mismatch.
 *   2. APP_URL / NEXT_PUBLIC_APP_URL — explicit override for non-NextAuth
 *      contexts (cron jobs, email links, etc).
 *   3. x-forwarded-proto / x-forwarded-host from the request — when behind a
 *      proxy that terminates TLS and we need to reflect the user's host.
 *   4. request.url origin — the literal host:port the request hit.
 *
 * Without this helper, OAuth flows break whenever the public hostname
 * (e.g. growzzy.com) differs from the internal one (e.g. the docker
 * container's port 3000) — Google sees a redirect_uri_mismatch and the user
 * gets bounced back with no useful error.
 */
export function resolveAppUrl(request?: Request): string {
  const fromEnv =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, "")

  if (request) {
    const headers = request.headers
    const proto = headers.get("x-forwarded-proto") || headers.get("x-forwarded-protocol")
    const host = headers.get("x-forwarded-host") || headers.get("host")
    if (proto && host) return `${proto}://${host}`
    try {
      return new URL(request.url).origin
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000"
}

/** Canonical OAuth redirect URI for the Google Ads handshake. */
export function googleOAuthRedirectUri(request?: Request): string {
  return `${resolveAppUrl(request)}/api/auth/google/callback`
}
