var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PrismaClient } from "@prisma/client";
function sanitizeDbUrl(raw) {
    const url = raw
        .replace(/^["'\s]+|["'\s]+$/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s/g, "")
        .trim();
    const atIndex = url.lastIndexOf("@");
    if (atIndex === -1)
        return url;
    const credentials = url.substring(0, atIndex + 1);
    const address = url.substring(atIndex + 1).replace(/:([^/]+)\//, (_match, portSection) => {
        const port = String(portSection).replace(/\D/g, "");
        return port ? `:${port}/` : `:${portSection}/`;
    });
    return credentials + address;
}
if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = sanitizeDbUrl(process.env.DATABASE_URL);
}
if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = sanitizeDbUrl(process.env.DIRECT_URL);
}
const prismaClientSingleton = () => {
    if (!process.env.DATABASE_URL) {
        console.error("[prisma] CRITICAL: database configuration is missing.");
    }
    return new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
        log: ["error", "warn"],
    });
};
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma || prismaClientSingleton();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
let migrationHealthChecked = false;
export function logSchemaHealthOnce() {
    return __awaiter(this, void 0, void 0, function* () {
        if (migrationHealthChecked)
            return;
        migrationHealthChecked = true;
        try {
            const rows = yield prisma.$queryRaw `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Lead' AND column_name = 'adAccountId'
      LIMIT 1
    `;
            if (!rows.length) {
                console.warn("[schema-health] Lead.adAccountId column missing. Run prisma migrate deploy.");
            }
        }
        catch (error) {
            console.warn("[schema-health] Unable to verify schema health.");
        }
    });
}
export function withDbTimeout(operation_1) {
    return __awaiter(this, arguments, void 0, function* (operation, timeoutMs = 8000) {
        if (!process.env.DATABASE_URL) {
            throw new Error("Database is not configured. Set DATABASE_URL in the current environment.");
        }
        return Promise.race([
            operation(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Database operation timed out. The database may be sleeping or unreachable.")), timeoutMs)),
        ]);
    });
}
export function dbErrorResponse(error) {
    const message = (error === null || error === void 0 ? void 0 : error.message) || "Unknown database error";
    if (message.includes("not configured") || message.includes("DATABASE_URL")) {
        return {
            error: "Database not configured",
            detail: "The DATABASE_URL environment variable is missing.",
            code: "DB_NOT_CONFIGURED",
            status: 503,
        };
    }
    if (message.includes("timed out") || message.includes("timeout")) {
        return {
            error: "Database unreachable",
            detail: "Cannot connect to the database. Verify the managed PostgreSQL database is available.",
            code: "DB_TIMEOUT",
            status: 503,
        };
    }
    if (message.includes("Can't reach") || message.includes("connect")) {
        return {
            error: "Database connection failed",
            detail: "Cannot reach the database server.",
            code: "DB_CONNECTION_FAILED",
            status: 503,
        };
    }
    if (message.includes("invalid port") || message.includes("connection string")) {
        return {
            error: "Invalid Database URL",
            detail: "The DATABASE_URL setting is malformed.",
            code: "DB_URL_INVALID",
            status: 500,
        };
    }
    return {
        error: "Database error",
        detail: message,
        code: "DB_ERROR",
        status: 500,
    };
}
