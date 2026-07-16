"use client"

import type React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react"

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
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
  const passwordStrength = (() => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (score <= 1) return { label: "Weak", className: "bg-red-500", width: "33%" }
    if (score <= 3) return { label: "Medium", className: "bg-amber-500", width: "66%" }
    return { label: "Strong", className: "bg-emerald-500", width: "100%" }
  })()

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
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          throw new Error("Invalid email or password.")
        }
        router.replace(callbackUrl)
      } else {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Registration failed")

        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

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
      const body = new URLSearchParams({
        csrfToken: csrfData.csrfToken,
        callbackUrl,
      })
      const res = await fetch("/api/auth/signin/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
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
    <main className="flex min-h-screen w-full bg-white text-black selection:bg-black/20 p-2 transition-all duration-500 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* LEFT COLUMN: video hero + onboarding roadmap */}
      <aside className="relative hidden lg:flex w-[52%] flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/35" />

        <div className="relative z-10 w-full max-w-xs space-y-8">
          <div className="flex items-center gap-2">
            <img src="/growzzy-logo.png" alt="Growzzy OS" className="h-7 w-7 object-contain bg-white rounded p-0.5" />
            <span className="text-xl font-heading italic tracking-tight text-white">Growzzy OS</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-heading italic tracking-tight text-white">
              {isLogin ? "Welcome back" : "Join Growzzy OS"}
            </h1>
            <p className="text-white/70 text-sm leading-relaxed font-body">
              {isLogin
                ? "Sign in to pick up right where you left off."
                : "Follow these 3 quick phases to activate your workspace."}
            </p>
          </div>

          {!isLogin && (
            <div className="space-y-3">
              <StepItem number={1} text="Create your identity" active />
              <StepItem number={2} text="Configure your workspace" />
              <StepItem number={3} text="Connect your advertising" />
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: form */}
      <section className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-md mx-auto space-y-8">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 font-heading italic text-xl tracking-tight text-black">
            <img src="/growzzy-logo.png" alt="Growzzy OS" className="h-8 w-8 object-contain" />
            Growzzy OS
          </Link>

          <div className="space-y-2">
            <h2 className="text-3xl font-heading italic tracking-tight text-black">
              {isLogin ? "Sign in to Growzzy OS" : "Create your profile"}
            </h2>
            <p className="text-black/50 text-sm font-body">
              {isLogin
                ? "Use your email or a Google account to continue."
                : "Input your basic details to begin the journey."}
            </p>
            {expired && isLogin && (
              <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Your session expired — please sign in again.
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              disabled={isLoading || isGoogleLoading || !googleAvailable}
              onClick={startGoogle}
              className="inline-flex items-center gap-3 bg-white border border-black/15 rounded-full h-11 px-6 text-sm font-medium text-black hover:bg-black/5 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              Continue with Google
            </button>
          </div>
          {!googleAvailable && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured in Vercel.
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs font-medium text-black/40 uppercase tracking-widest font-body">Or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-black">Full name</label>
                <input
                  type="text"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-100 border border-black/10 rounded-xl h-11 px-4 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/20"
                  required={!isLogin}
                />
                {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-black">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full bg-neutral-100 border border-black/10 rounded-xl h-11 px-4 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/20"
                required
              />
              {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-black">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-100 border border-black/10 rounded-xl h-11 px-4 pr-11 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/20"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              {!isLogin && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${passwordStrength.className}`} style={{ width: passwordStrength.width }} />
                  </div>
                  <p className="text-[11px] text-black/40">Password strength: {passwordStrength.label}</p>
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-black">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-neutral-100 border border-black/10 rounded-xl h-11 px-4 text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black/20"
                  required
                />
                {fieldErrors.confirmPassword && <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full h-12 bg-black text-white font-semibold rounded-xl hover:bg-black/90 active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-black/50 text-center font-body">
            {isLogin ? "New here? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError("")
                setFieldErrors({})
              }}
              className="text-black font-medium hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

function StepItem({ number, text, active = false }: { number: number; text: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-body ${
        active ? "bg-white text-black border border-white" : "bg-white/10 text-white border-none"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          active ? "bg-black text-white" : "bg-white/10 text-white/50"
        }`}
      >
        {number}
      </div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}
