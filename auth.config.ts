import type { NextAuthConfig } from 'next-auth';

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

if (process.env.NODE_ENV === "production" && !authSecret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured in production.")
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
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
            }
            return session;
        },
    },
    providers: [], // To be populated in auth.ts
} satisfies NextAuthConfig;
