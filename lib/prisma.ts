import { PrismaClient } from "@prisma/client"

function sanitizeDbUrl(raw: string): string {
  const url = raw
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s/g, "")
    .trim()
  const atIndex = url.lastIndexOf("@")
  if (atIndex === -1) return url

  const credentials = url.substring(0, atIndex + 1)
  const address = url.substring(atIndex + 1).replace(/:([^/]+)\//, (_match, portSection) => {
    const port = String(portSection).replace(/\D/g, "")
    return port ? `:${port}/` : `:${portSection}/`
  })
  return credentials + address
}

const configuredDatabaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
const configuredDirectUrl = process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || configuredDatabaseUrl

if (configuredDatabaseUrl) {
  process.env.DATABASE_URL = sanitizeDbUrl(configuredDatabaseUrl)
}
if (configuredDirectUrl) {
  process.env.DIRECT_URL = sanitizeDbUrl(configuredDirectUrl)
}

const prismaClientSingleton = () => {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://build:build@127.0.0.1:5432/build"
  if (!process.env.DATABASE_URL) {
    console.warn("[prisma] DATABASE_URL is missing; using an unreachable build-time fallback. Database requests will return a configuration error.")
  }
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ["error", "warn"],
  })
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof prismaClientSingleton> }

export const prisma = globalForPrisma.prisma || prismaClientSingleton()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

let migrationHealthChecked = false
export async function logSchemaHealthOnce() {
  if (migrationHealthChecked) return
  migrationHealthChecked = true
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Lead' AND column_name = 'adAccountId'
      LIMIT 1
    `
    if (!rows.length) {
      console.warn("[schema-health] Lead.adAccountId column missing. Run prisma migrate deploy.")
    }
  } catch (error: any) {
    console.warn("[schema-health] Unable to verify schema health.")
  }
}

export async function withDbTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 8000
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    throw new Error("Database is not configured. Set DATABASE_URL in the current environment.")
  }

  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Database operation timed out. The database may be sleeping or unreachable.")),
        timeoutMs
      )
    ),
  ])
}

export function dbErrorResponse(error: any) {
  const message = error?.message || "Unknown database error"

  if (message.includes("not configured") || message.includes("DATABASE_URL")) {
    return {
      error: "Database not configured",
      detail: "The DATABASE_URL environment variable is missing.",
      code: "DB_NOT_CONFIGURED",
      status: 503,
    }
  }

  if (message.includes("timed out") || message.includes("timeout")) {
    return {
      error: "Database unreachable",
      detail: "Cannot connect to the database. Verify the managed PostgreSQL database is available.",
      code: "DB_TIMEOUT",
      status: 503,
    }
  }

  if (message.includes("Can't reach") || message.includes("connect")) {
    return {
      error: "Database connection failed",
      detail: "Cannot reach the database server.",
      code: "DB_CONNECTION_FAILED",
      status: 503,
    }
  }

  if (message.includes("invalid port") || message.includes("connection string")) {
    return {
      error: "Invalid Database URL",
      detail: "The DATABASE_URL setting is malformed.",
      code: "DB_URL_INVALID",
      status: 500,
    }
  }

  return {
    error: "Database error",
    detail: message,
    code: "DB_ERROR",
    status: 500,
  }
}
