import { decrypt, encrypt } from "@/lib/crypto"

type TokenSource = {
  accessTokenEncrypted?: string | null
  refreshTokenEncrypted?: string | null
}

export function encryptedIntegrationTokens(accessToken: string, refreshToken?: string | null) {
  return {
    accessToken: null,
    refreshToken: null,
    accessTokenEncrypted: encrypt(accessToken),
    ...(refreshToken ? { refreshTokenEncrypted: encrypt(refreshToken) } : {}),
  }
}

export function getIntegrationAccessToken(integration: TokenSource): string | null {
  return integration.accessTokenEncrypted ? decrypt(integration.accessTokenEncrypted) : null
}

export function getIntegrationRefreshToken(integration: TokenSource): string | null {
  return integration.refreshTokenEncrypted ? decrypt(integration.refreshTokenEncrypted) : null
}
