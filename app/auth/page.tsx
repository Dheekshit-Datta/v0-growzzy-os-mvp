"use client"

import type React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, AlertCircle, Eye, EyeOff, BarChart3, Bot, Sparkles } from "lucide-react"

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>

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
  const [isLogin, setIsLogin] = useState(mode === "login" || mode === "signin") // Respect URL params
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

        // Auto login after register
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false
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

  return (
    <div className="flex min-h-screen bg-white font-satoshi selection:bg-blue-100 selection:text-blue-700">

      {/* LEFT COLUMN: FORM */}
      <div className="w-full lg:w-[52%] flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24 relative">
        <div className="max-w-md w-full mx-auto space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-gray-900">
            <div className="w-8 h-8 bg-[#1f57f5] rounded-lg flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            Growzzy
          </Link>

          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
              {isLogin ? "Welcome Back" : "Start Optimizing"}
            </h1>
            <p className="text-slate-500 text-base">
              {isLogin
                ? "Enter your email and password to access your autonomous dashboard."
                : "Join the top 1% of marketers using AI to scale their operations."}
            </p>
            {expired && isLogin && (
              <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Your session expired — please sign in again.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    placeholder="Roger Gerrard"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1f57f5] transition-all placeholder:text-slate-400"
                    required={!isLogin}
                  />
                  {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1f57f5] transition-all placeholder:text-slate-400"
                  required
                />
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1f57f5] transition-all placeholder:text-slate-400 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
                {!isLogin && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${passwordStrength.className}`} style={{ width: passwordStrength.width }} />
                    </div>
                    <p className="text-[11px] text-slate-500">Password strength: {passwordStrength.label}</p>
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1f57f5] transition-all placeholder:text-slate-400"
                    required
                  />
                  {fieldErrors.confirmPassword && <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full h-12 bg-[#1f57f5] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-[#1f57f5]/20 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </button>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled={isLoading || isGoogleLoading || !googleAvailable}
                onClick={async () => {
                  if (!googleAvailable) {
                    setError("Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.")
                    return
                  }
                  setIsGoogleLoading(true)
                  try {
                    await signIn("google", { callbackUrl })
                  } catch {
                    setIsGoogleLoading(false)
                    setError("Google sign-in failed to start. Check the Google OAuth redirect URI.")
                  }
                }}
                className="w-full h-12 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                )}
                Continue with Google
              </button>
              {!googleAvailable && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured in Vercel.
                </p>
              )}
            </div>
          </form>

          <div className="pt-6 relative text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <p className="relative bg-white px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isLogin ? "New to Growzzy?" : "Already have an account?"}
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); setFieldErrors({}) }}
              className="text-sm font-bold text-[#1f57f5] hover:opacity-80"
            >
              {isLogin ? "Join now" : "Sign In"}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AI GRAPHIC */}
      <div className="hidden lg:flex w-[48%] bg-[#0a0a0d] relative flex-col justify-center items-center overflow-hidden p-12">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1f57f5]/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-lg text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Scale without <br /> human limits.
            </h2>
            <p className="text-slate-400 text-lg">
              Let our AI Growth Engine handle your media buying and lead generation while you focus on the vision.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[430px] rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl bg-white/[0.08] p-4">
                <BarChart3 className="mb-8 h-5 w-5 text-blue-300" />
                <p className="text-xs uppercase tracking-widest text-slate-500">Spend</p>
                <p className="mt-1 text-2xl font-black text-white">$19.2K</p>
              </div>
              <div className="rounded-2xl bg-[#1f57f5] p-4">
                <Sparkles className="mb-8 h-5 w-5 text-white" />
                <p className="text-xs uppercase tracking-widest text-blue-100">ROAS Boost</p>
                <p className="mt-1 text-2xl font-black text-white">+42%</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-white/[0.08] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-300" />
                  <span className="text-sm font-semibold text-white">AI Optimization Engine</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-white/10"><div className="h-2 w-[78%] rounded-full bg-blue-500" /></div>
                  <div className="h-2 w-full rounded-full bg-white/10"><div className="h-2 w-[54%] rounded-full bg-cyan-400" /></div>
                  <div className="h-2 w-full rounded-full bg-white/10"><div className="h-2 w-[88%] rounded-full bg-emerald-400" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
