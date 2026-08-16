export const FEATURES = {
    META_ADS: process.env.NEXT_PUBLIC_ENABLE_META_ADS === "true" || process.env.ENABLE_META_ADS === "true",
    GOOGLE_ADS: true,
    AI_IMAGE_GENERATION: true,
    CAMPAIGN_CREATION: true,
    AUTOMATIONS: true,
    REPORTS: true,
    LEADS: true,
    AI_OPTIMIZATION: true,
};
export function isEnabled(feature) {
    return FEATURES[feature];
}
