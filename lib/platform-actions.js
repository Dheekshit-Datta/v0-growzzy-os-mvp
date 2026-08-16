var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function normalizeId(value) {
    return String(value).replace(/\D/g, "");
}
function googleHeaders(accessToken, loginCustomerId) {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        "Content-Type": "application/json",
    };
    if (loginCustomerId)
        headers["login-customer-id"] = normalizeId(loginCustomerId);
    return headers;
}
function googleAdsApiVersion() {
    return process.env.GOOGLE_ADS_API_VERSION || "v18";
}
function googleErrorMessage(payload, fallback) {
    var _a, _b, _c, _d, _e, _f;
    const base = ((_a = payload === null || payload === void 0 ? void 0 : payload.error) === null || _a === void 0 ? void 0 : _a.message) || fallback;
    const details = (_f = (_e = (_d = (_c = (_b = payload === null || payload === void 0 ? void 0 : payload.error) === null || _b === void 0 ? void 0 : _b.details) === null || _c === void 0 ? void 0 : _c.flatMap((detail) => (detail === null || detail === void 0 ? void 0 : detail.errors) || [])) === null || _d === void 0 ? void 0 : _d.map((error) => {
        var _a, _b;
        const path = (_b = (_a = error === null || error === void 0 ? void 0 : error.location) === null || _a === void 0 ? void 0 : _a.fieldPathElements) === null || _b === void 0 ? void 0 : _b.map((field) => field === null || field === void 0 ? void 0 : field.fieldName).filter(Boolean).join(".");
        const code = Object.values((error === null || error === void 0 ? void 0 : error.errorCode) || {})[0];
        return [path, code, error === null || error === void 0 ? void 0 : error.message].filter(Boolean).join(": ");
    })) === null || _e === void 0 ? void 0 : _e.filter(Boolean)) === null || _f === void 0 ? void 0 : _f.join(" | ");
    return details ? `${base} — ${details}` : base;
}
function mutateGoogle(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, loginCustomerId, resource, body, }) {
        const response = yield fetch(`https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/${resource}:mutate`, {
            method: "POST",
            headers: googleHeaders(accessToken, loginCustomerId),
            body: JSON.stringify(body),
        });
        const payload = yield response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(googleErrorMessage(payload, `Google Ads ${resource} mutate failed`));
        return payload;
    });
}
function mapObjectiveToChannelType(objective) {
    const normalized = (objective || "").toUpperCase();
    if (normalized.includes("PMAX") || normalized.includes("PERFORMANCE_MAX"))
        return "PERFORMANCE_MAX";
    if (normalized.includes("VIDEO"))
        return "VIDEO";
    if (normalized.includes("DISPLAY"))
        return "DISPLAY";
    if (normalized.includes("SHOPPING"))
        return "SHOPPING";
    if (normalized.includes("DEMAND_GEN") || normalized.includes("DEMANDGEN"))
        return "DEMAND_GEN";
    if (normalized.includes("APP"))
        return "MULTI_CHANNEL";
    return "SEARCH";
}
function googleBiddingConfig(strategy, targetCpaMicros, targetRoas) {
    if (strategy === "MAXIMIZE_CLICKS")
        return { targetSpend: {} };
    if (strategy === "TARGET_CPA") {
        if (!targetCpaMicros || targetCpaMicros <= 0)
            throw new Error("TARGET_CPA requires a positive target CPA");
        return { targetCpa: { targetCpaMicros } };
    }
    if (strategy === "TARGET_ROAS") {
        if (!targetRoas || targetRoas <= 0)
            throw new Error("TARGET_ROAS requires a positive target ROAS");
        return { targetRoas: { targetRoas } };
    }
    return { maximizeConversions: {} };
}
function createGoogleCampaignBudget(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, dailyBudgetMicros, loginCustomerId, }) {
        var _b, _c;
        const body = {
            operations: [
                {
                    create: {
                        name: `Growzzy Budget ${Date.now()}`,
                        amountMicros: dailyBudgetMicros,
                        deliveryMethod: "STANDARD",
                        explicitlyShared: false,
                    },
                },
            ],
        };
        const response = yield fetch(`https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaignBudgets:mutate`, { method: "POST", headers: googleHeaders(accessToken, loginCustomerId), body: JSON.stringify(body) });
        const payload = yield response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(googleErrorMessage(payload, "Failed to create Google campaign budget"));
        }
        const resourceName = (_c = (_b = payload === null || payload === void 0 ? void 0 : payload.results) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.resourceName;
        if (!resourceName)
            throw new Error("Google campaign budget resource name missing");
        return resourceName;
    });
}
export function applyGoogleCampaignCriteria(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, campaignResourceName, locations = ["United States"], languages = ["English"], loginCustomerId, }) {
        const operations = [];
        const geoMap = {
            "united states": "geoTargetConstants/2840",
            "us": "geoTargetConstants/2840",
            "usa": "geoTargetConstants/2840",
            "india": "geoTargetConstants/2356",
            "in": "geoTargetConstants/2356",
            "united kingdom": "geoTargetConstants/2826",
            "uk": "geoTargetConstants/2826",
            "canada": "geoTargetConstants/2124",
            "australia": "geoTargetConstants/2036",
        };
        const locList = Array.isArray(locations) && locations.length ? locations : ["United States"];
        locList.forEach((loc) => {
            const geoId = geoMap[String(loc).toLowerCase().trim()] || "geoTargetConstants/2840";
            operations.push({
                create: {
                    campaign: campaignResourceName,
                    location: { geoTargetConstant: geoId },
                },
            });
        });
        operations.push({
            create: {
                campaign: campaignResourceName,
                language: { languageConstant: "languageConstants/1000" },
            },
        });
        try {
            yield fetch(`https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaignCriteria:mutate`, {
                method: "POST",
                headers: googleHeaders(accessToken, loginCustomerId),
                body: JSON.stringify({ operations }),
            });
        }
        catch (err) {
            console.warn("Failed to set Google campaign criteria:", err);
        }
    });
}
export function createGoogleAdsCampaign(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, name, dailyBudgetMicros, objective, biddingStrategy = "MAXIMIZE_CONVERSIONS", targetCpaMicros, targetRoas, status = "PAUSED", locations = ["United States"], languages = ["English"], loginCustomerId, }) {
        var _b, _c;
        const budgetResource = yield createGoogleCampaignBudget({
            accessToken,
            customerId,
            dailyBudgetMicros,
            loginCustomerId,
        });
        const body = {
            operations: [
                {
                    create: Object.assign({ name,
                        status, campaignBudget: budgetResource, advertisingChannelType: mapObjectiveToChannelType(objective), containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING" }, googleBiddingConfig(biddingStrategy, targetCpaMicros, targetRoas)),
                },
            ],
        };
        const response = yield fetch(`https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaigns:mutate`, { method: "POST", headers: googleHeaders(accessToken, loginCustomerId), body: JSON.stringify(body) });
        const payload = yield response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(googleErrorMessage(payload, "Failed to create Google Ads campaign"));
        }
        const resourceName = (_c = (_b = payload === null || payload === void 0 ? void 0 : payload.results) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.resourceName;
        const campaignId = resourceName ? String(resourceName).split("/").pop() : null;
        if (!campaignId || !resourceName)
            throw new Error("Google campaign resource ID missing");
        yield applyGoogleCampaignCriteria({
            accessToken,
            customerId,
            campaignResourceName: resourceName,
            locations,
            languages,
            loginCustomerId,
        });
        return { campaignId, resourceName, budgetResourceName: budgetResource };
    });
}
export function updateGoogleCampaignStatus(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, campaignId, status, loginCustomerId, }) {
        const campaignResource = campaignId.includes("customers/")
            ? campaignId
            : `customers/${normalizeId(customerId)}/campaigns/${normalizeId(campaignId)}`;
        return mutateGoogle({
            accessToken,
            customerId,
            loginCustomerId,
            resource: "campaigns",
            body: {
                operations: [
                    {
                        update: {
                            resourceName: campaignResource,
                            status,
                        },
                        updateMask: "status",
                    },
                ],
            },
        });
    });
}
export function createGoogleAdGroup(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, campaignId, name, defaultBidMicros, loginCustomerId, }) {
        var _b, _c;
        const campaignResource = campaignId.includes("customers/")
            ? campaignId
            : `customers/${normalizeId(customerId)}/campaigns/${normalizeId(campaignId)}`;
        const body = {
            operations: [
                {
                    create: Object.assign({ name, campaign: campaignResource, status: "ENABLED" }, (defaultBidMicros && defaultBidMicros > 0 ? { cpcBidMicros: defaultBidMicros } : {})),
                },
            ],
        };
        const payload = yield mutateGoogle({
            accessToken,
            customerId,
            loginCustomerId,
            resource: "adGroups",
            body,
        });
        const resourceName = (_c = (_b = payload === null || payload === void 0 ? void 0 : payload.results) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.resourceName;
        const adGroupId = resourceName ? String(resourceName).split("/").pop() : null;
        if (!adGroupId)
            throw new Error("Google ad group resource ID missing");
        return { adGroupId, resourceName };
    });
}
export function createGoogleKeywords(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, adGroupId, keywords, loginCustomerId, }) {
        const groupResource = adGroupId.includes("customers/")
            ? adGroupId
            : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`;
        const operations = keywords
            .filter((k) => k.text && k.text.trim())
            .map((k) => ({
            create: Object.assign({ adGroup: groupResource, status: "ENABLED", keyword: {
                    text: k.text.trim(),
                    matchType: k.matchType || "PHRASE",
                } }, (k.bid && k.bid > 0 ? { cpcBidMicros: Math.round(k.bid * 1000000) } : {})),
        }));
        if (!operations.length)
            return { count: 0 };
        return mutateGoogle({
            accessToken,
            customerId,
            loginCustomerId,
            resource: "adGroupCriteria",
            body: { operations },
        });
    });
}
export function createGoogleResponsiveSearchAd(_a) {
    return __awaiter(this, arguments, void 0, function* ({ accessToken, customerId, adGroupId, headlines, descriptions, finalUrl, displayPath1, displayPath2, loginCustomerId, }) {
        const groupResource = adGroupId.includes("customers/")
            ? adGroupId
            : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`;
        const validHeadlines = headlines
            .filter((h) => h.text && h.text.trim())
            .slice(0, 15)
            .map((h) => (Object.assign({ text: h.text.trim().slice(0, 30) }, (h.pinPosition ? { pinnedField: `HEADLINE_${h.pinPosition}` } : {}))));
        const validDescriptions = descriptions
            .filter((d) => d.text && d.text.trim())
            .slice(0, 4)
            .map((d) => ({
            text: d.text.trim().slice(0, 90),
        }));
        if (validHeadlines.length < 3)
            throw new Error("At least 3 valid headlines (<=30 chars) required for RSA ad");
        if (validDescriptions.length < 1)
            throw new Error("At least 1 valid description (<=90 chars) required for RSA ad");
        const body = {
            operations: [
                {
                    create: {
                        adGroup: groupResource,
                        status: "ENABLED",
                        ad: Object.assign(Object.assign(Object.assign({ finalUrls: [finalUrl] }, (displayPath1 ? { path1: displayPath1.slice(0, 15) } : {})), (displayPath2 ? { path2: displayPath2.slice(0, 15) } : {})), { responsiveSearchAd: {
                                headlines: validHeadlines,
                                descriptions: validDescriptions,
                            } }),
                    },
                },
            ],
        };
        return mutateGoogle({
            accessToken,
            customerId,
            loginCustomerId,
            resource: "adGroupAd",
            body,
        });
    });
}
