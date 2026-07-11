import { PrismaClient } from '@prisma/client'

/**
 * Fix a malformed port in a postgres connection URL.
 * The debug log showed the actual URL in Vercel has ":**6543" as the port
 * (with garbage chars before the digits) instead of ":6543".
 * Prisma therefore reads "**6543" as the port → "invalid port number".
 *
 * Strategy: find the LAST @ sign (which separates credentials from host),
 * then in the host:port section strip any non-digit characters from the PORT.
 */
function fixMalformedPort(url: string): string {
  const atIdx = url.lastIndexOf('@')
  if (atIdx === -1) return url

  const afterAt = url.substring(atIdx + 1) // "host:PORT/database?params"

  // Match :PORT/ where PORT may contain non-digit garbage characters
  const fixed = afterAt.replace(/:([^/]+)\//, (_match, portSection) => {
    const cleanPort = portSection.replace(/\D/g, '') // keep only digits
    if (cleanPort !== portSection && cleanPort.length > 0) {
      console.log(`[prisma] ✅ Fixed malformed port: ":${portSection}" → ":${cleanPort}" (removed: "${portSection.replace(/\d/g, '')}") `)
    }
    return `:${cleanPort}/`
  })

  return url.substring(0, atIdx + 1) + fixed
}

/**
 * Full URL sanitization pipeline:
 * 1. Strip surrounding quotes and standard whitespace
 * 2. Strip ALL non-printable-ASCII chars (catches Unicode ghost chars from copy-paste)
 * 3. Strip any remaining embedded whitespace
 * 4. Fix malformed port number (strips non-digit chars that sneak in before port digits)
 */
function sanitizeDbUrl(raw: string): string {
  const step1 = raw
    .replace(/^["'\s]+|["'\s]+$/g, '') // trim surrounding quotes + whitespace
    .replace(/[^\x20-\x7E]/g, '')       // strip ALL non-printable-ASCII
    .replace(/\s/g, '')                  // strip remaining spaces/tabs
    .trim()
  return fixMalformedPort(step1)
}

// Sanitize and MUTATE env vars in-place BEFORE PrismaClient is created.
if (process.env.DATABASE_URL) {
  const raw = process.env.DATABASE_URL
  const clean = sanitizeDbUrl(raw)
  process.env.DATABASE_URL = clean
  const masked = clean.replace(/:[^:@]*@/, ':****@')
  console.log(`[prisma] DB URL raw:${raw.length} → clean:${clean.length} | ${masked.substring(0, 100)}...`)
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = sanitizeDbUrl(process.env.DIRECT_URL)
}

const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    console.error('[prisma] CRITICAL: DATABASE_URL is not set.')
  }
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: ['error', 'warn'],
  })
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof prismaClientSingleton> }

export const prisma = globalForPrisma.prisma || prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
      console.warn("[schema-health] Lead.adAccountId column missing. Run `prisma migrate deploy` to align production schema.")
    }
  } catch (error: any) {
    console.warn("[schema-health] Unable to verify schema health:", error?.message || "unknown error")
  }
}

/**
 * Executes a database operation with a timeout to prevent infinite hangs.
 * This is critical for Vercel where serverless functions have execution limits.
 */
export async function withDbTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 8000
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Database is not configured. Please set DATABASE_URL in your environment variables.' +
      ' For Vercel: Go to Project → Settings → Environment Variables.'
    )
  }

  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Database operation timed out. The database may be sleeping or unreachable.')),
        timeoutMs
      )
    ),
  ])
}

/**
 * Standard error response for API routes
 */
export function dbErrorResponse(error: any) {
  const message = error?.message || 'Unknown database error'

  if (message.includes('not configured') || message.includes('DATABASE_URL')) {
    return {
      error: 'Database not configured',
      detail: 'The DATABASE_URL environment variable is missing. Add it in Vercel → Settings → Environment Variables.',
      code: 'DB_NOT_CONFIGURED',
      status: 503,
    }
  }

  if (message.includes('timed out') || message.includes('timeout')) {
    return {
      error: 'Database unreachable',
      detail: 'Cannot connect to the database. Verify the managed PostgreSQL database is available and DATABASE_URL is correct.',
      code: 'DB_TIMEOUT',
      status: 503,
    }
  }

  if (message.includes("Can't reach") || message.includes('connect')) {
    return {
      error: 'Database connection failed',
      detail: 'Cannot reach the database server. Verify DATABASE_URL and database availability.',
      code: 'DB_CONNECTION_FAILED',
      status: 503,
    }
  }

  if (message.includes('invalid port') || message.includes('connection string')) {
    return {
      error: 'Invalid Database URL',
      detail: 'The DATABASE_URL in Vercel settings is malformed. Check for extra quotes (") around the URL or spaces.',
      code: 'DB_URL_INVALID',
      status: 500,
    }
  }

  return {
    error: 'Database error',
    detail: message,
    code: 'DB_ERROR',
    status: 500,
  }
}
