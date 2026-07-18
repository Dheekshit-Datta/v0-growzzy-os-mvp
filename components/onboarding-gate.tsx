"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Sends users who have not finished onboarding to /dashboard/onboarding.
 *
 * Trusts the API's `shouldShowOnboarding` (onboardingCompleted OR a real
 * connected ad account) rather than onboardingCompleted alone. The only way
 * to mark onboardingCompleted=true is clicking one of two specific buttons
 * at the very end of onboarding step 3 - if a user connects a real ad
 * account but never reaches/clicks that button (e.g. got confused by an
 * OAuth redirect hiccup, closed the tab, navigated away), onboardingCompleted
 * stays false forever and this gate would otherwise bounce them back to
 * onboarding on every single future login, indefinitely. Having a real
 * connected integration is itself sufficient evidence they're past onboarding.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // The onboarding page itself must always render.
    if (pathname?.startsWith("/dashboard/onboarding")) {
      setChecked(true)
      return
    }
    if (checked) return

    let cancelled = false
    fetch("/api/onboarding", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (data.shouldShowOnboarding) {
          router.replace("/dashboard/onboarding")
        }
      })
      .catch(() => {
        /* never trap the user because a check failed */
      })
      .finally(() => {
        if (!cancelled) setChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [pathname, checked, router])

  return <>{children}</>
}
