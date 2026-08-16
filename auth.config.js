var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured in production.");
}
export const authConfig = {
    session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
    jwt: { maxAge: 7 * 24 * 60 * 60 },
    pages: {
        signIn: '/auth',
    },
    trustHost: true,
    secret: authSecret || "development-only-secret-do-not-deploy",
    callbacks: {
        jwt(_a) {
            return __awaiter(this, arguments, void 0, function* ({ token, user }) {
                if (user) {
                    token.id = user.id;
                    token.email = user.email;
                }
                return token;
            });
        },
        session(_a) {
            return __awaiter(this, arguments, void 0, function* ({ session, token }) {
                if (session.user) {
                    session.user.id = token.id;
                    session.user.email = token.email;
                }
                return session;
            });
        },
    },
    providers: [], // To be populated in auth.ts
};
