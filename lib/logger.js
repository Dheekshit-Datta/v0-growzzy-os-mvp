import * as Sentry from "@sentry/nextjs";
const SENSITIVE_KEYS = [
    "accessToken",
    "refreshToken",
    "password",
    "secret",
    "token",
    "apiKey",
    "authorization",
    "cookie",
    "email",
];
function sanitize(value) {
    if (!value || typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map(sanitize);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
        if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
            return [key, "[REDACTED]"];
        }
        return [key, sanitize(entry)];
    }));
}
export function log(level, context, message, data) {
    const payload = sanitize(Object.assign({ timestamp: new Date().toISOString(), level: level.toUpperCase(), context,
        message }, (data ? { data } : {})));
    if (process.env.NODE_ENV === "production") {
        const line = JSON.stringify(payload);
        if (level === "debug")
            console.log(line);
        else
            console[level](line);
        return;
    }
    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${context}]`;
    if (data)
        console[level === "debug" ? "log" : level](prefix, message, sanitize(data));
    else
        console[level === "debug" ? "log" : level](prefix, message);
}
export function reportError(error, context, data) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    Sentry.withScope((scope) => {
        scope.setTag("context", context);
        if (data)
            scope.setContext("details", sanitize(data));
        Sentry.captureException(normalized);
    });
    log("error", context, normalized.message, data);
}
