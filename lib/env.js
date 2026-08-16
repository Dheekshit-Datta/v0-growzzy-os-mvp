import { log } from "@/lib/logger";
const REQUIRED_SERVER_ENV = ["DATABASE_URL", "NEXTAUTH_URL"];
const OPTIONAL_WITH_WARNING = [
    "OPENAI_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "CRON_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "META_APP_ID",
    "META_APP_SECRET",
    "META_REDIRECT_URI",
    "RESEND_API_KEY",
];
export function validateEnv({ strict = false } = {}) {
    var _a, _b, _c;
    if (typeof window !== "undefined")
        return;
    const missing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);
    if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
        missing.push("AUTH_SECRET or NEXTAUTH_SECRET");
    }
    if (process.env.NODE_ENV === "production" && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) {
        missing.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    }
    const optionalMissing = OPTIONAL_WITH_WARNING.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        const message = `Missing required environment variables: ${missing.join(", ")}`;
        if (strict)
            throw new Error(message);
        log("warn", "env", message);
    }
    if (optionalMissing.length > 0 && process.env.NODE_ENV === "production") {
        log("warn", "env", `Optional environment variables missing: ${optionalMissing.join(", ")}`);
    }
    const appUrl = (_a = process.env.NEXTAUTH_URL) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, "");
    const googleRedirect = (_b = process.env.GOOGLE_REDIRECT_URI) === null || _b === void 0 ? void 0 : _b.replace(/\/$/, "");
    const metaRedirect = (_c = process.env.META_REDIRECT_URI) === null || _c === void 0 ? void 0 : _c.replace(/\/$/, "");
    if (appUrl && googleRedirect && googleRedirect !== `${appUrl}/api/auth/google/callback`) {
        const message = `GOOGLE_REDIRECT_URI must be ${appUrl}/api/auth/google/callback for Google Ads integration`;
        if (strict)
            throw new Error(message);
        log("warn", "env", message);
    }
    if (process.env.ENABLE_META_ADS === "true" && appUrl && metaRedirect !== `${appUrl}/api/auth/meta/callback`) {
        const message = `META_REDIRECT_URI must be ${appUrl}/api/auth/meta/callback`;
        if (strict)
            throw new Error(message);
        log("warn", "env", message);
    }
}
