import type { Prisma } from "@prisma/client"
import { encrypt, decrypt } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_BINDING_KEY = "googleRefreshTokenCustomerBinding"

export type GoogleTokenBinding = {
  refreshToken: string
  customerId: string | null
  storedAt: string
}

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

export function decryptGoogleTokenBinding(accountInfo: Prisma.JsonValue | null): GoogleTokenBinding | null {
  const info = asObject(accountInfo)
  const encryptedBinding = info[TOKEN_BINDING_KEY]
  if (typeof encryptedBinding !== "string" || !encryptedBinding) {
    return null
  }

  try {
    const decrypted = decrypt(encryptedBinding)
    return JSON.parse(decrypted) as GoogleTokenBinding
  } catch {
    return null
  }
}

export async function persistEncryptedGoogleTokenBinding({
  integrationId,
  refreshToken,
  customerId,
}: {
  integrationId: string
  refreshToken?: string | null
  customerId?: string | null
}): Promise<void> {
  if (!refreshToken) return

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { accountInfo: true },
  })

  const accountInfo = asObject(integration?.accountInfo ?? null)
  const payload: GoogleTokenBinding = {
    refreshToken,
    customerId: customerId || null,
    storedAt: new Date().toISOString(),
  }

  accountInfo[TOKEN_BINDING_KEY] = encrypt(JSON.stringify(payload))

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      accountInfo: accountInfo as Prisma.JsonObject,
    },
  })
}
