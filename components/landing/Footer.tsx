'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Footer() {
  const pathname = usePathname()
  const isLanding = pathname === '/'
  const href = (hash: string) => (isLanding ? hash : `/${hash}`)

  if (pathname?.startsWith('/auth')) return null

  return (
    <footer className="border-t border-neutral-200 bg-white px-8 py-12 md:px-16">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        {/* Left: logo + wordmark */}
        <div className="flex items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white liquid-glass-light">
            <Image
              src="/growzzy-logo.png"
              alt="GrowzzyOS logo"
              width={24}
              height={24}
              className="h-5 w-5 object-contain"
            />
          </span>
          <span className="ml-3 text-sm text-neutral-500">GrowzzyOS</span>
        </div>

        {/* Right: nav links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500">
          <Link href={href('#home')} className="hover:text-neutral-900">
            Home
          </Link>
          <Link href={href('#features')} className="hover:text-neutral-900">
            Features
          </Link>
          <Link href={href('#pricing')} className="hover:text-neutral-900">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-neutral-900">
            Terms
          </Link>
        </nav>
      </div>

      <p className="mt-8 text-center font-body text-xs text-neutral-400">
        © 2026 GrowzzyOS. Built for founders who move fast.
      </p>
    </footer>
  )
}
