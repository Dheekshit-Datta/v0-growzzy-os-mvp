"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

export default function MetaAuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      setStatus("error")
      setTimeout(() => {
        router.push("/dashboard/settings?tab=integrations&error=meta_auth_failed")
      }, 2000)
      return
    }

    if (code) {
      setStatus("success")
      setTimeout(() => {
        router.push("/dashboard/settings?tab=integrations&success=meta_connected")
      }, 2000)
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {status === "loading" && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Connecting to Meta...</h2>
            <p className="text-gray-600">Please wait while we authenticate your account.</p>
          </div>
        )}
        {status === "success" && (
          <div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-green-600">Successfully Connected!</h2>
            <p className="text-gray-600">Your Meta account has been connected.</p>
          </div>
        )}
        {status === "error" && (
          <div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-600">Connection Failed</h2>
            <p className="text-gray-600">There was an error connecting to Meta.</p>
          </div>
        )}
      </div>
    </div>
  )
}
