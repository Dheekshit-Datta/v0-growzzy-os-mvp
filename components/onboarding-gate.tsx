"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Sends users who have not finished onboarding to /dashboard/onboarding.
 *
 * Deliberately narrow, unlike the old OnboardingEnforcer:
 *  - keys off User.onboardingCompleted ONLY (never campaign count / integration state)
 *  - never blocks or hides any page while it checks
 *  - runs one check per mount and gets out of the way
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
        if (data.onboardingCompleted === false) {
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
