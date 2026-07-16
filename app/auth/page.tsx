"use client"

import type React from "react"
import { Suspense, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"

const STEPS = [
  { number: 1, text: "Create your identity" },
  { number: 2, text: "Configure your workspace" },
  { number: 3, text: "Connect your advertising" },
]

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.85 14.1a6.62 6.62 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.85 9.9C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.13-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AuthPageContent />
    </Suspense>
  )
}

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode")
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const expired = searchParams.get("expired") === "1"
  const [isLogin, setIsLogin] = useState(mode === "login" || mode === "signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(true)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((providers) => {
        if (providers && !providers.google) setGoogleAvailable(false)
      })
      .catch(() => setGoogleAvailable(false))
  }, [])

  const validate = () => {
    const next: FieldErrors = {}
    if (!isLogin && name.trim().length < 2) next.name = "Please enter your full name"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please enter a valid email"
    if (password.length < 8) next.password = "Password must be at least 8 characters"
    if (!isLogin && password !== confirmPassword) next.confirmPassword = "Passwords do not match"
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || isGoogleLoading) return
    if (!validate()) return
    setIsLoading(true)
    setError("")

    try {
      if (isLogin) {
        const result = await signIn("credentials", { email, password, redirect: false })
        if (result?.error) throw new Error("Invalid email or password.")
        router.replace(callbackUrl)
      } else {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Registration failed")

        const result = await signIn("credentials", { email, password, redirect: false })
        if (result?.error) throw new Error("Login after registration failed")
        router.replace(callbackUrl === "/dashboard" ? "/dashboard/onboarding" : callbackUrl)
      }
    } catch (err: any) {
      if (err?.name === "TypeError") {
        setError("Connection failed — please check your internet")
      } else {
        setError(err.message)
      }
      setIsLoading(false)
    }
  }

  const startGoogle = async () => {
    if (!googleAvailable) {
      setError("Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.")
      return
    }
    setIsGoogleLoading(true)
    try {
      const csrfRes = await fetch("/api/auth/csrf")
      const csrfData = await csrfRes.json()
      const body = new URLSearchParams({ csrfToken: csrfData.csrfToken, callbackUrl })
      const res = await fetch("/api/auth/signin/google", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
        body,
      })
      const data = await res.json()
      if (!data?.url) throw new Error("Missing Google OAuth URL")
      window.location.href = data.url
    } catch {
      setIsGoogleLoading(false)
      setError("Google sign-in failed to start. Check the Google OAuth redirect URI.")
    }
  }

  return (
    <main className="flex min-h-screen w-full bg-white p-2 transition-all duration-500 selection:bg-neutral-200 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* Left column: hero + video */}
      <div className="relative hidden h-full w-[52%] flex-col items-center justify-end overflow-hidden rounded-3xl px-12 pb-32 shadow-2xl lg:flex">
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline>
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/30" />

        <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 w-full max-w-xs space-y-8">
          <motion.div variants={item} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Image src="/growzzy-logo.png" alt="GrowzzyOS logo" width={28} height={28} className="h-6 w-6 object-contain" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-white">GrowzzyOS</span>
          </motion.div>

          <motion.div variants={item} className="space-y-3">
            <h2 className="whitespace-nowrap text-4xl font-medium tracking-tight text-white">
              {isLogin ? "Welcome Back" : "Join GrowzzyOS"}
            </h2>
            <p className="px-1 text-sm leading-relaxed text-white/60">
              {isLogin ? "Sign in to your GrowzzyOS workspace." : "Follow these 3 quick phases to activate your space."}
            </p>
          </motion.div>

          {!isLogin && (
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <motion.div key={step.number} variants={item}>
                  <StepItem number={step.number} text={step.text} active={i === 0} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Right column: form */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-12 sm:px-12 lg:overflow-hidden lg:px-16 lg:py-6 xl:px-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-xl space-y-8 sm:space-y-10 lg:space-y-6"
        >
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900">
              <Image src="/growzzy-logo.png" alt="GrowzzyOS logo" width={28} height={28} className="h-6 w-6 object-contain" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-neutral-900">GrowzzyOS</span>
          </Link>

          <div className="space-y-2">
            <h1 className="text-3xl font-medium tracking-tight text-neutral-900">
              {isLogin ? "Welcome Back" : "Create New Profile"}
            </h1>
            <p className="text-sm text-neutral-500">
              {isLogin ? "Sign in to your GrowzzyOS workspace." : "Input your basic details to begin the journey."}
            </p>
            {expired && isLogin && (
              <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Your session expired — please sign in again.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={isLoading || isGoogleLoading || !googleAvailable}
              onClick={startGoogle}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
              Google
            </button>
            <button
              type="button"
              disabled
              title="GitHub sign-in is not available yet"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-400 cursor-not-allowed opacity-60"
            >
              <GithubIcon className="h-4 w-4" />
              Github
            </button>
          </div>
          {!googleAvailable && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured in Vercel.
            </p>
          )}

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-neutral-200" />
            <span className="bg-white px-4 text-xs font-medium uppercase tracking-widest text-neutral-400">Or</span>
            <div className="flex-1 border-t border-neutral-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-900">Full name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    required={!isLogin}
                  />
                  {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-900">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                required
              />
              {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-900">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 pr-11 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-900"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              {!isLogin && <p className="text-xs text-neutral-400">Requires at least 8 symbols.</p>}
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-900">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  required
                />
                {fieldErrors.confirmPassword && <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="mt-4 h-14 w-full rounded-xl bg-neutral-900 font-semibold text-white transition-transform hover:bg-neutral-800 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-sm text-neutral-500">
            {isLogin ? "Don't have an account? " : "Member of the team? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError("")
                setFieldErrors({})
              }}
              className="font-medium text-neutral-900 hover:underline"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>

          <p className="text-xs leading-relaxed text-neutral-400">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline hover:text-neutral-600">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-neutral-600">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </main>
  )
}

function StepItem({ number, text, active = false }: { number: number; text: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${active ? "border border-white bg-white text-black" : "border-none bg-white/10 text-white"}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-black text-white" : "bg-white/10 text-white/40"}`}>
        {number}
      </span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}
