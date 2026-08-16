import { log } from "@/lib/logger";
export function logSlowApi(route, startedAtMs, extra) {
    const durationMs = Date.now() - startedAtMs;
    if (durationMs > 1500) {
        log("warn", "api/slow", "Slow API request", Object.assign({ route, durationMs }, (extra || {})));
    }
}
