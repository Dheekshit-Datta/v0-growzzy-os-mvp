import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma, withDbTimeout } from "./prisma"
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
  adapter: PrismaAdapter(prisma),
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
          const user = await withDbTimeout(
            () =>
              prisma.user.findUnique({
                where: { email: inputEmail },
              }),
            5000
          )

          if (!user) {
            log("warn", "auth", "User not found", { email: inputEmail })
            throw new Error("Invalid credentials")
          }

          const isPasswordValid = await bcrypt.compare(inputPassword, user.password)

          if (!isPasswordValid) {
            log("warn", "auth", "Invalid password", { email: inputEmail })
            throw new Error("Invalid credentials")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
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
