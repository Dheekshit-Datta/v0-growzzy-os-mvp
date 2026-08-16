var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { log } from "@/lib/logger";
const DEFAULT_GOOGLE_ADS_API_VERSION = "v22";
const GOOGLE_ADS_API_VERSION = (process.env.GOOGLE_ADS_API_VERSION || DEFAULT_GOOGLE_ADS_API_VERSION).trim();
const GOOGLE_OAUTH_SCOPE = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
const CANONICAL_GOOGLE_CLIENT_ID = "11828421627-n5mns7q2qq2b04rl5igefntjjru50hje.apps.googleusercontent.com";
const CUSTOMER_CLIENT_DISCOVERY_QUERY = "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED'";
export class GoogleAdsApiError extends Error {
    constructor({ path, status, summary, errorCode, payload, apiVersion, loginCustomerId, hasDeveloperToken, }) {
        const versionNote = apiVersion ? ` [${apiVersion}]` : "";
        const loginNote = loginCustomerId ? ` [login-customer-id:${normalizeCustomerId(loginCustomerId)}]` : "";
        const tokenNote = hasDeveloperToken === false ? " [developer-token:missing]" : "";
        super(`Google Ads API request failed at ${path}${versionNote}${loginNote}${tokenNote} (status ${status}): ${summary}`);
        this.name = "GoogleAdsApiError";
        this.path = path;
        this.status = status;
        this.summary = summary;
        this.errorCode = errorCode;
        this.payload = payload;
        this.apiVersion = apiVersion;
        this.loginCustomerId = loginCustomerId;
        this.hasLoginCustomerId = Boolean(loginCustomerId);
        this.hasDeveloperToken = hasDeveloperToken;
    }
}
function flattenErrorCandidates(input) {
    if (!input)
        return [];
    if (Array.isArray(input))
        return input.flatMap((x) => flattenErrorCandidates(x));
    if (typeof input !== "object")
        return [];
    return [input];
}
function getGoogleAdsErrorSummary(errorPayload) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const candidates = flattenErrorCandidates(errorPayload);
    const firstMessage = ((_b = (_a = candidates.find((entry) => { var _a; return typeof ((_a = entry === null || entry === void 0 ? void 0 : entry.error) === null || _a === void 0 ? void 0 : _a.message) === "string"; })) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message) ||
        ((_c = candidates.find((entry) => typeof (entry === null || entry === void 0 ? void 0 : entry.message) === "string")) === null || _c === void 0 ? void 0 : _c.message) ||
        "Unknown Google Ads API error";
    const firstGoogleAdsError = (_h = (_g = (_f = (_e = (_d = candidates
        .find((entry) => { var _a; return Array.isArray((_a = entry === null || entry === void 0 ? void 0 : entry.error) === null || _a === void 0 ? void 0 : _a.details); })) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.details) === null || _f === void 0 ? void 0 : _f.find((detail) => Array.isArray(detail === null || detail === void 0 ? void 0 : detail.errors) && detail.errors.length > 0)) === null || _g === void 0 ? void 0 : _g.errors) === null || _h === void 0 ? void 0 : _h[0];
    const firstErrorCode = (firstGoogleAdsError === null || firstGoogleAdsError === void 0 ? void 0 : firstGoogleAdsError.errorCode) || ((_j = candidates.find((entry) => entry === null || entry === void 0 ? void 0 : entry.errorCode)) === null || _j === void 0 ? void 0 : _j.errorCode);
    const parsedCode = firstErrorCode && typeof firstErrorCode === "object"
        ? Object.keys(firstErrorCode)[0]
        : typeof firstErrorCode === "string"
            ? firstErrorCode
            : undefined;
    return {
        summary: firstMessage,
        errorCode: parsedCode,
    };
}
function isAuthorizationDiscoveryError(error) {
    if (!(error instanceof GoogleAdsApiError))
        return false;
    if (error.status !== 403)
        return false;
    const code = (error.errorCode || "").toLowerCase();
    const summary = (error.summary || "").toLowerCase();
    return code.includes("authorizationerror") || summary.includes("does not have permission");
}
function normalizeCustomerId(customerId) {
    return String(customerId).replace(/\D/g, "");
}
function getGoogleClientId() {
    return (process.env.GOOGLE_CLIENT_ID || CANONICAL_GOOGLE_CLIENT_ID).trim();
}
function getGoogleClientSecret() {
    const primarySecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (primarySecret)
        return primarySecret;
    const legacySecret = (process.env.GOOGLE_ADS_CLIENT_SECRET || "").trim();
    if (legacySecret) {
        log("warn", "google/oauth", "Using legacy Google client-secret environment variable");
        return legacySecret;
    }
    throw new Error("Missing GOOGLE_CLIENT_SECRET environment variable for Google OAuth token exchange");
}
function resolveRedirectUri(override) {
    return (override || process.env.GOOGLE_REDIRECT_URI || "https://v0-growzzyos.vercel.app/api/auth/google/callback").trim();
}
function parseGoogleAdsErrorCodes(errorPayload) {
    const payload = JSON.stringify(errorPayload || {});
    const knownCodes = ["RATE_EXCEEDED", "EXCESSIVE_RESOURCE_CONSUMPTION"];
    return knownCodes.filter((code) => payload.includes(code));
}
function isRetryableGoogleAdsError(status, errorPayload) {
    if (status === 429 || status === 503)
        return true;
    return parseGoogleAdsErrorCodes(errorPayload).length > 0;
}
function buildGoogleAdsHeaders(accessToken, loginCustomerId) {
    const developerToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
    };
    if (loginCustomerId) {
        headers["login-customer-id"] = normalizeCustomerId(loginCustomerId);
    }
    return headers;
}
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise((resolve) => setTimeout(resolve, ms));
    });
}
function getGoogleAdsBaseUrl(apiVersion) {
    return `https://googleads.googleapis.com/${apiVersion}`;
}
function getDiscoveryFallbackVersions(primaryVersion) {
    const fromEnv = (process.env.GOOGLE_ADS_DISCOVERY_FALLBACK_VERSIONS || "")
        .split(",")
        .map((version) => version.trim())
        .filter(Boolean);
    const defaults = ["v22", "v21", "v20", "v19", "v18"];
    const ordered = [...fromEnv, ...defaults];
    const unique = Array.from(new Set(ordered));
    return unique.filter((version) => version !== primaryVersion);
}
function requestWithVersionFallback(_a) {
    return __awaiter(this, arguments, void 0, function* ({ path, accessToken, method, body, loginCustomerId, primaryVersion, fallbackVersions, }) {
        let primaryError = null;
        try {
            return yield requestWithRetry({
                path,
                accessToken,
                method,
                body,
                loginCustomerId,
                apiVersion: primaryVersion,
            });
        }
        catch (error) {
            if (!(error instanceof GoogleAdsApiError) || error.status !== 404) {
                throw error;
            }
            primaryError = error;
        }
        for (const fallbackVersion of fallbackVersions) {
            try {
                const payload = yield requestWithRetry({
                    path,
                    accessToken,
                    method,
                    body,
                    loginCustomerId,
                    apiVersion: fallbackVersion,
                });
                log("warn", "google/ads", "Request used fallback API version", { path, fallbackVersion, primaryVersion });
                return payload;
            }
            catch (error) {
                if (!(error instanceof GoogleAdsApiError) || error.status !== 404) {
                    throw error;
                }
                primaryError = error;
            }
        }
        throw primaryError || new Error(`Google Ads API request failed at ${path}`);
    });
}
function requestWithRetry(_a) {
    return __awaiter(this, arguments, void 0, function* ({ path, accessToken, method = "GET", body, loginCustomerId, maxRetries = 4, apiVersion = GOOGLE_ADS_API_VERSION, }) {
        const url = `${getGoogleAdsBaseUrl(apiVersion)}${path}`;
        const developerToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
        if (!developerToken) {
            throw new GoogleAdsApiError({
                path,
                status: 400,
                summary: "Missing GOOGLE_ADS_DEVELOPER_TOKEN",
                errorCode: "DEVELOPER_TOKEN_MISSING",
                payload: {},
                apiVersion,
                loginCustomerId,
                hasDeveloperToken: false,
            });
        }
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = yield fetch(url, Object.assign({ method, headers: buildGoogleAdsHeaders(accessToken, loginCustomerId) }, (body !== undefined ? { body: JSON.stringify(body) } : {})));
            const payload = yield response.json().catch(() => ({}));
            if (response.ok) {
                return payload;
            }
            if (attempt < maxRetries && isRetryableGoogleAdsError(response.status, payload)) {
                const jitterMs = Math.floor(Math.random() * 250);
                const delayMs = Math.min(12000, 500 * Math.pow(2, attempt) + jitterMs);
                yield sleep(delayMs);
                continue;
            }
            const { summary, errorCode } = getGoogleAdsErrorSummary(payload);
            const normalizedLoginCustomerId = loginCustomerId ? normalizeCustomerId(loginCustomerId) : null;
            log("error", "google/ads", "Google Ads API request failed", {
                path,
                apiVersion,
                status: response.status,
                summary,
                errorCode,
                hasLoginCustomerId: Boolean(normalizedLoginCustomerId),
                loginCustomerId: normalizedLoginCustomerId,
                hasDeveloperToken: true,
            });
            throw new GoogleAdsApiError({
                path,
                status: response.status,
                summary,
                errorCode,
                payload,
                apiVersion,
                loginCustomerId,
                hasDeveloperToken: true,
            });
        }
        throw new Error("Google Ads API request exhausted retry attempts");
    });
}
function fetchCustomerClientRows(accessToken, customerId, loginCustomerId) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = `/customers/${normalizeCustomerId(customerId)}/googleAds:searchStream`;
        let streamResponse = null;
        let lastError = null;
        try {
            streamResponse = yield requestWithVersionFallback({
                path,
                method: "POST",
                accessToken,
                loginCustomerId,
                body: { query: CUSTOMER_CLIENT_DISCOVERY_QUERY },
                primaryVersion: GOOGLE_ADS_API_VERSION,
                fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
            });
        }
        catch (error) {
            lastError = error;
        }
        // For non-manager standalone roots, a login-customer-id matching the same account can fail with 403.
        // Retry once without login header to preserve standalone-account discovery.
        if (!streamResponse &&
            loginCustomerId &&
            normalizeCustomerId(loginCustomerId) === normalizeCustomerId(customerId) &&
            lastError instanceof GoogleAdsApiError &&
            lastError.status === 403) {
            streamResponse = yield requestWithVersionFallback({
                path,
                method: "POST",
                accessToken,
                body: { query: CUSTOMER_CLIENT_DISCOVERY_QUERY },
                primaryVersion: GOOGLE_ADS_API_VERSION,
                fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
            });
        }
        if (!streamResponse) {
            throw (lastError || new Error(`Google Ads API request failed at ${path}`));
        }
        return Array.isArray(streamResponse)
            ? streamResponse.flatMap((chunk) => { var _a; return (_a = chunk.results) !== null && _a !== void 0 ? _a : []; })
            : [];
    });
}
export const GoogleAdsService = {
    getOAuthClientId() {
        return getGoogleClientId();
    },
    getRedirectUri(override) {
        return resolveRedirectUri(override);
    },
    getAuthUrl(options) {
        const clientId = getGoogleClientId();
        const redirectUri = this.getRedirectUri(options === null || options === void 0 ? void 0 : options.redirectUri);
        const state = options === null || options === void 0 ? void 0 : options.state;
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        if (state)
            url.searchParams.set("state", state);
        return url.toString();
    },
    exchangeCode(code, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const clientId = getGoogleClientId();
            const clientSecret = getGoogleClientSecret();
            const redirectUri = this.getRedirectUri(options === null || options === void 0 ? void 0 : options.redirectUri);
            log("info", "google/oauth", "Starting token exchange", { clientId, redirectUri });
            const response = yield fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code",
                }),
            });
            const tokens = yield response.json().catch(() => ({ error: "invalid_token_response" }));
            if (!response.ok || tokens.error) {
                log("error", "google/oauth", "Token exchange failed", {
                    status: response.status,
                    clientId,
                    redirectUri,
                    hasGoogleClientSecret: Boolean(clientSecret),
                    error: tokens.error,
                    errorDescription: tokens.error_description,
                });
                throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error || `HTTP ${response.status}`}`);
            }
            return tokens;
        });
    },
    refreshAccessToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: getGoogleClientId(),
                    client_secret: getGoogleClientSecret(),
                    refresh_token: refreshToken,
                    grant_type: "refresh_token",
                }),
            });
            const data = yield response.json();
            if (data.error) {
                throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
            }
            return data;
        });
    },
    listAccessibleCustomers(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = "/customers:listAccessibleCustomers";
            const data = yield requestWithVersionFallback({
                path,
                accessToken,
                method: "GET",
                primaryVersion: GOOGLE_ADS_API_VERSION,
                fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
            });
            return (data.resourceNames || []).map((resourceName) => normalizeCustomerId(resourceName.replace("customers/", "")));
        });
    },
    searchStream(_a) {
        return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, query, loginCustomerId, }) {
            return requestWithVersionFallback({
                path: `/customers/${normalizeCustomerId(customerId)}/googleAds:searchStream`,
                method: "POST",
                accessToken,
                loginCustomerId,
                body: { query },
                primaryVersion: GOOGLE_ADS_API_VERSION,
                fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
            });
        });
    },
    discoverClientAccounts(accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const rootCustomerIds = yield this.listAccessibleCustomers(accessToken);
            const actionableAccounts = new Map();
            const traversalErrors = [];
            let usedAuthorizationFallback = false;
            for (const rootCustomerId of rootCustomerIds) {
                try {
                    const rootRows = yield fetchCustomerClientRows(accessToken, rootCustomerId, rootCustomerId);
                    const selfRow = rootRows.find((row) => { var _a; return normalizeCustomerId(((_a = row.customerClient) === null || _a === void 0 ? void 0 : _a.id) || "") === rootCustomerId; });
                    const childRows = rootRows.filter((row) => { var _a; return normalizeCustomerId(((_a = row.customerClient) === null || _a === void 0 ? void 0 : _a.id) || "") !== rootCustomerId; });
                    if (childRows.length === 0) {
                        if (selfRow && ((_a = selfRow.customerClient) === null || _a === void 0 ? void 0 : _a.manager) === false) {
                            actionableAccounts.set(rootCustomerId, {
                                externalId: rootCustomerId,
                                name: ((_b = selfRow.customerClient) === null || _b === void 0 ? void 0 : _b.descriptiveName) || `Google Ads ${rootCustomerId}`,
                                currency: "USD",
                                managerCustomerId: null,
                                isManager: false,
                                level: (_c = selfRow.customerClient) === null || _c === void 0 ? void 0 : _c.level,
                                status: (_d = selfRow.customerClient) === null || _d === void 0 ? void 0 : _d.status,
                            });
                        }
                        continue;
                    }
                    const visitedManagers = new Set();
                    const walkHierarchy = (managerCustomerId) => __awaiter(this, void 0, void 0, function* () {
                        const normalizedManagerId = normalizeCustomerId(managerCustomerId);
                        if (visitedManagers.has(normalizedManagerId))
                            return;
                        visitedManagers.add(normalizedManagerId);
                        const rows = yield fetchCustomerClientRows(accessToken, normalizedManagerId, rootCustomerId);
                        for (const row of rows) {
                            const customerClient = row.customerClient;
                            const childId = normalizeCustomerId((customerClient === null || customerClient === void 0 ? void 0 : customerClient.id) || "");
                            if (!childId || childId === normalizedManagerId)
                                continue;
                            if (customerClient === null || customerClient === void 0 ? void 0 : customerClient.manager) {
                                yield walkHierarchy(childId);
                                continue;
                            }
                            actionableAccounts.set(childId, {
                                externalId: childId,
                                name: (customerClient === null || customerClient === void 0 ? void 0 : customerClient.descriptiveName) || `Google Ads ${childId}`,
                                currency: "USD",
                                managerCustomerId: rootCustomerId,
                                isManager: false,
                                level: customerClient === null || customerClient === void 0 ? void 0 : customerClient.level,
                                status: customerClient === null || customerClient === void 0 ? void 0 : customerClient.status,
                            });
                        }
                    });
                    yield walkHierarchy(rootCustomerId);
                }
                catch (rootError) {
                    if (isAuthorizationDiscoveryError(rootError)) {
                        log("warn", "google/discovery", "Authorization-limited root traversal", {
                            rootCustomerId,
                            message: rootError instanceof Error ? rootError.message : "Unknown error",
                        });
                        usedAuthorizationFallback = true;
                        actionableAccounts.set(rootCustomerId, {
                            externalId: rootCustomerId,
                            name: `Google Ads ${rootCustomerId}`,
                            currency: "USD",
                            managerCustomerId: null,
                            isManager: false,
                            status: "ENABLED",
                            discoveryFallback: "AUTHORIZATION",
                        });
                        continue;
                    }
                    log("warn", "google/discovery", "Root traversal failed", {
                        rootCustomerId,
                        message: rootError instanceof Error ? rootError.message : "Unknown error",
                    });
                    traversalErrors.push({ customerId: rootCustomerId, error: rootError });
                }
            }
            if (usedAuthorizationFallback) {
                log("warn", "google/discovery", "Authorization fallback enabled for one or more roots", {
                    roots: rootCustomerIds,
                });
            }
            if (actionableAccounts.size === 0 && traversalErrors.length > 0) {
                const firstError = (_e = traversalErrors[0]) === null || _e === void 0 ? void 0 : _e.error;
                if (firstError instanceof GoogleAdsApiError) {
                    throw firstError;
                }
                throw new Error(`Google Ads discovery failed for ${traversalErrors.length} account root(s) with no actionable clients found`);
            }
            return Array.from(actionableAccounts.values());
        });
    },
    updateCampaignStatus(_a) {
        return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, campaignId, status, loginCustomerId, }) {
            return requestWithRetry({
                path: `/customers/${normalizeCustomerId(customerId)}/campaigns:mutate`,
                accessToken,
                method: "POST",
                loginCustomerId,
                body: {
                    operations: [
                        {
                            update: {
                                resourceName: `customers/${normalizeCustomerId(customerId)}/campaigns/${normalizeCustomerId(campaignId)}`,
                                status,
                            },
                            updateMask: "status",
                        },
                    ],
                },
            });
        });
    },
    updateAdGroupStatus(_a) {
        return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, adGroupId, status, loginCustomerId, }) {
            return requestWithRetry({
                path: `/customers/${normalizeCustomerId(customerId)}/adGroups:mutate`,
                accessToken,
                method: "POST",
                loginCustomerId,
                body: {
                    operations: [
                        {
                            update: {
                                resourceName: `customers/${normalizeCustomerId(customerId)}/adGroups/${normalizeCustomerId(adGroupId)}`,
                                status,
                            },
                            updateMask: "status",
                        },
                    ],
                },
            });
        });
    },
    updateCampaignBudget(_a) {
        return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, campaignBudgetResourceName, amountMicros, loginCustomerId, }) {
            const resourceName = campaignBudgetResourceName.includes("customers/")
                ? campaignBudgetResourceName
                : `customers/${normalizeCustomerId(customerId)}/campaignBudgets/${normalizeCustomerId(campaignBudgetResourceName)}`;
            return requestWithRetry({
                path: `/customers/${normalizeCustomerId(customerId)}/campaignBudgets:mutate`,
                accessToken,
                method: "POST",
                loginCustomerId,
                body: {
                    operations: [
                        {
                            update: {
                                resourceName,
                                amountMicros,
                            },
                            updateMask: "amount_micros",
                        },
                    ],
                },
            });
        });
    },
};
