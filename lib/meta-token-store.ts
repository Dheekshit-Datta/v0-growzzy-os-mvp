import type { Prisma } from "@prisma/client"
import { decrypt, encrypt } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_BINDING_KEY = "metaEncryptedTokenBinding"

export type MetaTokenBinding = {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
  storedAt: string
}

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function decryptMetaTokenBinding(accountInfo: Prisma.JsonValue | null): MetaTokenBinding | null {
  const info = asObject(accountInfo)
  const encryptedBinding = info[TOKEN_BINDING_KEY]
  if (typeof encryptedBinding !== "string" || !encryptedBinding) return null

  try {
    return JSON.parse(decrypt(encryptedBinding)) as MetaTokenBinding
  } catch {
    return null
  }
}

export async function persistEncryptedMetaTokenBinding({
  integrationId,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  integrationId: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
}): Promise<void> {
  if (!accessToken) return

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { accountInfo: true },
  })

  const accountInfo = asObject(integration?.accountInfo ?? null)
  accountInfo[TOKEN_BINDING_KEY] = encrypt(
    JSON.stringify({
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      storedAt: new Date().toISOString(),
    } satisfies MetaTokenBinding)
  )

  await prisma.integration.update({
    where: { id: integrationId },
    data: { accountInfo: accountInfo as Prisma.JsonObject },
  })
}
