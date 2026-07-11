"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Mail, Check, AlertCircle, Loader2 } from "lucide-react"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "pending">("pending")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token")

      if (token) {
        setStatus("verifying")

        try {
          const response = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          })
          const result = await response.json()

          if (!response.ok) {
            setStatus("error")
            setMessage(result.error || "Failed to verify email. The link may have expired.")
          } else {
            setStatus("success")
            setMessage("Email verified successfully!")
            setTimeout(() => router.push("/dashboard"), 2000)
          }
        } catch (err: any) {
          setStatus("error")
          setMessage(err.message || "An error occurred during verification")
        }
      } else {
        setStatus("pending")
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="w-full min-h-screen bg-[#f7f5f3] flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#37322f] flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl">
            <span className="font-semibold">GROWZZY</span>
            <span className="font-light opacity-60"> OS</span>
          </span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl text-white leading-tight font-serif font-normal">
            Verify your email to get started with <span className="text-[#f97316] italic">GROWZZY OS</span>
          </h1>
          <p className="text-white/60 text-lg font-normal">
            {status === "success"
              ? "Your email has been verified. Redirecting to your dashboard..."
              : "We've sent a verification link to your email address. Click the link to confirm your account."}
          </p>
        </div>

        <p className="text-white/40 text-sm">© 2025 GROWZZY. All rights reserved.</p>
      </div>

      {/* Right Side - Verification */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link
          href="/"
          className="absolute top-6 left-6 lg:left-auto lg:right-6 flex items-center gap-2 text-[#37322f]/60 hover:text-[#37322f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              {status === "verifying" && (
                <div className="w-16 h-16 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#f97316] animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
              )}
              {status === "error" && (
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              )}
              {status === "pending" && (
                <div className="w-16 h-16 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-[#f97316]" />
                </div>
              )}
            </div>
            <h2 className="text-2xl text-[#37322f] mb-2 font-serif">
              {status === "verifying" && "Verifying email..."}
              {status === "success" && "Email verified!"}
              {status === "error" && "Verification failed"}
              {status === "pending" && "Verify your email"}
            </h2>
            <p className="text-[#37322f]/60 font-normal">
              {status === "success" && "Redirecting to dashboard..."}
              {status === "error" && message}
              {status === "verifying" && "Please wait..."}
              {status === "pending" && "Check your email for verification link"}
            </p>
          </div>

          {status !== "success" && (
            <div className="rounded-xl bg-[#f7f5f3] border border-[#37322f]/10 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                </div>
                <p className="text-sm text-[#37322f]/70">Check your email for verification link</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                </div>
                <p className="text-sm text-[#37322f]/70">Click the link to verify your account</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#f97316]" />
                </div>
                <p className="text-sm text-[#37322f]/70">You'll be redirected to your dashboard</p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <Link href="/auth">
              <button className="w-full h-12 border border-[#37322f]/20 text-[#37322f] rounded-xl bg-transparent hover:bg-[#f7f5f3] transition-colors">
                Back to sign in
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-[#f7f5f3]" />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
