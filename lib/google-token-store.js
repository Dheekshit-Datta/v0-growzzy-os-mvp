var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { encrypt, decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
const TOKEN_BINDING_KEY = "googleRefreshTokenCustomerBinding";
function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value;
}
export function decryptGoogleTokenBinding(accountInfo) {
    const info = asObject(accountInfo);
    const encryptedBinding = info[TOKEN_BINDING_KEY];
    if (typeof encryptedBinding !== "string" || !encryptedBinding) {
        return null;
    }
    try {
        const decrypted = decrypt(encryptedBinding);
        return JSON.parse(decrypted);
    }
    catch (_a) {
        return null;
    }
}
export function persistEncryptedGoogleTokenBinding(_a) {
    return __awaiter(this, arguments, void 0, function* ({ integrationId, refreshToken, customerId, }) {
        var _b;
        if (!refreshToken)
            return;
        const integration = yield prisma.integration.findUnique({
            where: { id: integrationId },
            select: { accountInfo: true },
        });
        const accountInfo = asObject((_b = integration === null || integration === void 0 ? void 0 : integration.accountInfo) !== null && _b !== void 0 ? _b : null);
        const payload = {
            refreshToken,
            customerId: customerId || null,
            storedAt: new Date().toISOString(),
        };
        accountInfo[TOKEN_BINDING_KEY] = encrypt(JSON.stringify(payload));
        yield prisma.integration.update({
            where: { id: integrationId },
            data: {
                accountInfo: accountInfo,
            },
        });
    });
}
