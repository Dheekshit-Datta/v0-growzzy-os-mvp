import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { authConfig } from "../auth.config"
import { log } from "./logger"
import { rateLimit } from "./rate-limit"
import { resolveUserId } from "./resolve-user"

const googleAuthProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            scope: "openid email profile",
            prompt: "select_account",
          },
        },
      })
    : null

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [
    ...(googleAuthProvider ? [googleAuthProvider] : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const inputEmail = ((credentials?.email as string) || "").toLowerCase().trim()
        const inputPassword = (credentials?.password as string) || ""

        const limit = await rateLimit(`auth:credentials:${inputEmail || "missing"}`, 8, 60_000, {
          strict: true,
        })
        if (!limit.allowed) {
          throw new Error(
            limit.unavailable
              ? "Sign-in protection is temporarily unavailable"
              : "Too many sign-in attempts. Please try again shortly."
          )
        }

        if (!inputEmail || !inputPassword) {
          throw new Error("Email and password required")
        }

        try {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          if (!supabaseUrl || !supabaseKey) throw new Error("Authentication service is not configured")

          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: supabaseKey },
            body: JSON.stringify({ email: inputEmail, password: inputPassword }),
            cache: "no-store",
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || !data?.user?.id) {
            log("warn", "auth", "Supabase credential sign-in failed", { email: inputEmail, status: response.status })
            throw new Error(data?.error_code === "email_not_confirmed" ? "Please confirm your email before signing in." : "Invalid email or password.")
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email,
            image: data.user.user_metadata?.avatar_url || null,
          }
        } catch (error: any) {
          log("error", "auth", "Authorize error", { message: error.message })

          if (
            error.message.includes("not configured") ||
            error.message.includes("timed out") ||
            error.message.includes("reaching") ||
            error.message.includes("connection") ||
            error.message.includes("reach")
          ) {
            throw new Error(
              "Database is not reachable. If deploying to Vercel, add DATABASE_URL in Settings -> Environment Variables."
            )
          }
          throw new Error(error.message || "Authentication failed")
        }
      },
    }),
  ],
})

export async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return await resolveUserId(session.user.id)
}
