const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function isAllowedBrowserMutation(input) {
    if (!MUTATION_METHODS.has(input.method.toUpperCase()) || !input.pathname.startsWith("/api/"))
        return true;
    if (input.pathname.startsWith("/api/cron/") || input.pathname.startsWith("/api/webhooks/"))
        return true;
    if (input.originHeader) {
        try {
            return new URL(input.originHeader).origin === input.requestOrigin;
        }
        catch (_a) {
            return false;
        }
    }
    return !input.fetchSite || input.fetchSite === "same-origin" || input.fetchSite === "none";
}
export function requestPassesSameOrigin(req) {
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto");
    const host = req.headers.get("x-forwarded-host");
    return isAllowedBrowserMutation({
        method: req.method,
        pathname: url.pathname,
        requestOrigin: proto && host ? `${proto}://${host}` : url.origin,
        originHeader: req.headers.get("origin"),
        fetchSite: req.headers.get("sec-fetch-site"),
    });
}
