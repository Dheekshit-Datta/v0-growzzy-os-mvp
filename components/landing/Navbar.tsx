'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Home', hash: '#home' },
  { label: 'Features', hash: '#features' },
  { label: 'How It Works', hash: '#how' },
  { label: 'Pricing', hash: '#pricing' },
]

export function Navbar() {
  const pathname = usePathname()
  const isAuth = pathname?.startsWith('/auth')
  const isLanding = pathname === '/'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isLanding) {
      setScrolled(true)
      return
    }
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight - 80)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isLanding])

  const href = (hash: string) => (isLanding ? hash : `/${hash}`)

  if (isAuth) return null

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-8 lg:px-16">
      <nav className="flex items-center justify-between">
        {/* Left: logo */}
        <Link
          href={isLanding ? '#home' : '/'}
          aria-label="GrowzzyOS home"
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            scrolled ? 'liquid-glass-light bg-white' : 'liquid-glass-dark bg-white'
          }`}
        >
          <Image
            src="/growzzy-logo.png"
            alt="GrowzzyOS logo"
            width={32}
            height={32}
            className="h-7 w-7 object-contain"
          />
        </Link>

        {/* Center: desktop nav pill */}
        <div
          className={`hidden items-center gap-1 rounded-full px-1.5 py-1.5 lg:flex ${
            scrolled ? 'liquid-glass-light' : 'liquid-glass-dark'
          }`}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={href(link.hash)}
              className={`rounded-full px-4 py-2 font-body text-sm font-medium transition-colors ${
                scrolled
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth"
            className={`rounded-full px-4 py-2 font-body text-sm font-medium transition-colors ${
              scrolled
                ? 'text-neutral-600 hover:text-neutral-900'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
          >
            Launch Free
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Right: spacer to balance the logo on desktop */}
        <div className="hidden h-12 w-12 lg:block" aria-hidden />

        {/* Mobile CTA */}
        <Link
          href="/auth"
          className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-black lg:hidden"
        >
          Launch Free
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </nav>
    </header>
  )
}
