var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const localStore = new Map();
export const RATE_LIMIT_POLICIES = {
    aiUtility: { burst: [20, 60000], day: 100, month: 1000 },
    campaignPlan: { burst: [5, 60000], day: 20, month: 200 },
    creativeText: { burst: [10, 60000], day: 20, month: 200 },
    imageGeneration: { burst: [3, 60000], day: 10, month: 100 },
    platformSync: { burst: [3, 5 * 60000], day: 24, month: 500 },
    campaignLaunch: { burst: [2, 60000], day: 5, month: 50 },
    optimizationMutation: { burst: [10, 60000], day: 50, month: 500 },
};
const SLIDING_WINDOW_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[2])
local count = redis.call("ZCARD", KEYS[1])
if count >= tonumber(ARGV[4]) then
  local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  local retry = tonumber(ARGV[3])
  if oldest[2] then retry = math.max(1, tonumber(oldest[2]) + tonumber(ARGV[3]) - tonumber(ARGV[1])) end
  return {0, retry}
end
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[5])
redis.call("PEXPIRE", KEYS[1], ARGV[3])
return {1, 0}
`;
function localRateLimit(key, limit, windowMs) {
    const now = Date.now();
    const recent = (localStore.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
    if (recent.length >= limit) {
        localStore.set(key, recent);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
    }
    recent.push(now);
    localStore.set(key, recent);
    return { allowed: true, retryAfter: 0 };
}
export function rateLimit(key_1, limit_1, windowMs_1) {
    return __awaiter(this, arguments, void 0, function* (key, limit, windowMs, options = {}) {
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!redisUrl || !redisToken) {
            if (options.strict)
                return { allowed: false, retryAfter: 60, unavailable: true };
            return localRateLimit(key, limit, windowMs);
        }
        const now = Date.now();
        const redisKey = `growzzy:rate-limit:${key}`;
        try {
            const response = yield fetch(redisUrl.replace(/\/$/, ""), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${redisToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify([
                    "EVAL",
                    SLIDING_WINDOW_SCRIPT,
                    "1",
                    redisKey,
                    String(now),
                    String(now - windowMs),
                    String(windowMs),
                    String(limit),
                    `${now}:${crypto.randomUUID()}`,
                ]),
                cache: "no-store",
            });
            if (!response.ok)
                throw new Error("Rate limit storage request failed");
            const payload = yield response.json();
            const result = payload === null || payload === void 0 ? void 0 : payload.result;
            if (!Array.isArray(result))
                throw new Error("Invalid rate limit response");
            return {
                allowed: Number(result[0]) === 1,
                retryAfter: Math.max(0, Math.ceil(Number(result[1] || 0) / 1000)),
            };
        }
        catch (_a) {
            if (options.strict)
                return { allowed: false, retryAfter: 60, unavailable: true };
            return localRateLimit(key, limit, windowMs);
        }
    });
}
export function rateLimitPolicy(subject, policyName) {
    return __awaiter(this, void 0, void 0, function* () {
        const policy = RATE_LIMIT_POLICIES[policyName];
        const windows = [
            { scope: "burst", limit: policy.burst[0], windowMs: policy.burst[1] },
            { scope: "day", limit: policy.day, windowMs: 24 * 60 * 60000 },
            { scope: "month", limit: policy.month, windowMs: 30 * 24 * 60 * 60000 },
        ];
        for (const window of windows) {
            const result = yield rateLimit(`${policyName}:${window.scope}:${subject}`, window.limit, window.windowMs, { strict: true });
            if (!result.allowed)
                return Object.assign(Object.assign({}, result), { scope: window.scope });
        }
        return { allowed: true, retryAfter: 0 };
    });
}
export function rateLimitError(result) {
    return {
        body: {
            ok: false,
            error: {
                code: result.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
                message: result.unavailable
                    ? "Request protection is temporarily unavailable. Please try again shortly."
                    : `Usage limit reached${result.scope ? ` for this ${result.scope}` : ""}. Please try again later.`,
            },
        },
        status: result.unavailable ? 503 : 429,
        headers: { "Retry-After": String(Math.max(1, result.retryAfter)) },
    };
}
export function rateLimitResponse(result) {
    const error = rateLimitError(result);
    return Response.json(error.body, { status: error.status, headers: error.headers });
}
