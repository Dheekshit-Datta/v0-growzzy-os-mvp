var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * CSRF state generation and verification for OAuth flows.
 * State is stored in a short-lived httpOnly cookie.
 */
import crypto from "crypto";
import { cookies } from "next/headers";
const STATE_TTL_SECONDS = 600; // 10 minutes
export function generateState() {
    return crypto.randomBytes(24).toString("hex");
}
export function getStateCookieName(provider) {
    return `oauth_state_${provider}`;
}
export function stateMatches(incomingState, storedState) {
    if (!incomingState || !storedState)
        return false;
    if (Buffer.byteLength(incomingState, "utf8") !== Buffer.byteLength(storedState, "utf8"))
        return false;
    return crypto.timingSafeEqual(Buffer.from(incomingState, "utf8"), Buffer.from(storedState, "utf8"));
}
/** Set a state cookie on the given response */
export function attachStateCookie(response, provider, state) {
    const name = getStateCookieName(provider);
    response.cookies.set(name, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: STATE_TTL_SECONDS,
        path: "/",
    });
    return response;
}
/** Read and validate state from incoming request */
export function verifyState(provider, incomingState) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const cookieStore = yield cookies();
        return stateMatches(incomingState, ((_a = cookieStore.get(getStateCookieName(provider))) === null || _a === void 0 ? void 0 : _a.value) || null);
    });
}
/** Clear the state cookie after callback */
export function clearStateCookie(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const cookieStore = yield cookies();
        cookieStore.delete(getStateCookieName(provider));
    });
}
