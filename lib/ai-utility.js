var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { log } from "./logger.ts";
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage } from "./ai-credits.ts";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const CACHE_TTL_SECONDS = 24 * 60 * 60;
export const UTILITY_MODEL = process.env.OPENAI_UTILITY_MODEL || "gpt-4o-mini";
export function aiErrorMetadata(error) {
    const value = error && typeof error === "object" ? error : {};
    return {
        status: typeof value.status === "number" ? value.status : null,
        code: typeof value.code === "string" ? value.code.slice(0, 80) : null,
        type: typeof value.type === "string" ? value.type.slice(0, 80) : error instanceof Error ? error.name : "UnknownError",
    };
}
export function aiUnavailableMessage(error) {
    const meta = aiErrorMetadata(error);
    if (meta.status === 429 && meta.code === "insufficient_quota") {
        return "OpenAI quota is exhausted for this API key. Add billing/credits in OpenAI, then redeploy.";
    }
    return "AI is temporarily unavailable. Your brief is safe; try again shortly.";
}
export function utilityCacheKey(operation, workspaceId, input) {
    const digest = createHash("sha256").update(JSON.stringify({ operation, workspaceId, input })).digest("hex");
    return `growzzy:ai-cache:${operation}:${digest}`;
}
function redis(command) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const url = (_a = process.env.UPSTASH_REDIS_REST_URL) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, "");
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token)
            return null;
        const response = yield fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(command),
            cache: "no-store",
        });
        if (!response.ok)
            throw new Error("AI cache request failed");
        return (_c = (_b = (yield response.json())) === null || _b === void 0 ? void 0 : _b.result) !== null && _c !== void 0 ? _c : null;
    });
}
export function cachedUtilityCompletion(call) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const startedAt = Date.now();
        let model = UTILITY_MODEL;
        const key = utilityCacheKey(call.operation, call.workspaceId, call.input);
        try {
            const cached = yield redis(["GET", key]);
            if (typeof cached === "string") {
                log("info", "ai/usage", "AI utility completed", {
                    route: call.route,
                    model,
                    inputTokens: 0,
                    outputTokens: 0,
                    durationMs: Date.now() - startedAt,
                    cacheHit: true,
                    userId: call.userId,
                    workspaceId: call.workspaceId,
                });
                return cached;
            }
        }
        catch (_h) {
            // Cache is a cost optimization; route rate limits remain fail-closed separately.
        }
        let completion;
        yield assertCreditsAvailable(call.workspaceId, estimatedCredits(model));
        try {
            completion = yield openai.chat.completions.create(Object.assign({ model, messages: call.messages }, (call.json ? { response_format: { type: "json_object" } } : {})));
        }
        catch (error) {
            if (model === "gpt-4o-mini")
                throw error;
            model = "gpt-4o-mini";
            completion = yield openai.chat.completions.create(Object.assign({ model, messages: call.messages }, (call.json ? { response_format: { type: "json_object" } } : {})));
        }
        const content = ((_c = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) || "";
        yield recordCreditUsage({
            workspaceId: call.workspaceId,
            userId: call.userId,
            route: call.route,
            model,
            inputTokens: (_d = completion.usage) === null || _d === void 0 ? void 0 : _d.prompt_tokens,
            outputTokens: (_e = completion.usage) === null || _e === void 0 ? void 0 : _e.completion_tokens,
        });
        if (content) {
            try {
                yield redis(["SET", key, content, "EX", String(CACHE_TTL_SECONDS)]);
            }
            catch (_j) {
                // A successful model response should not fail because the optional cache write failed.
            }
        }
        log("info", "ai/usage", "AI utility completed", {
            route: call.route,
            model,
            inputTokens: ((_f = completion.usage) === null || _f === void 0 ? void 0 : _f.prompt_tokens) || 0,
            outputTokens: ((_g = completion.usage) === null || _g === void 0 ? void 0 : _g.completion_tokens) || 0,
            durationMs: Date.now() - startedAt,
            cacheHit: false,
            userId: call.userId,
            workspaceId: call.workspaceId,
        });
        return content;
    });
}
