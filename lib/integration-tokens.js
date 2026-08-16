import { decrypt, encrypt } from "@/lib/crypto";
export function encryptedIntegrationTokens(accessToken, refreshToken) {
    return Object.assign({ accessToken: null, refreshToken: null, accessTokenEncrypted: encrypt(accessToken) }, (refreshToken ? { refreshTokenEncrypted: encrypt(refreshToken) } : {}));
}
export function getIntegrationAccessToken(integration) {
    return integration.accessTokenEncrypted ? decrypt(integration.accessTokenEncrypted) : null;
}
export function getIntegrationRefreshToken(integration) {
    return integration.refreshTokenEncrypted ? decrypt(integration.refreshTokenEncrypted) : null;
}
