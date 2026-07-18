'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, Play } from 'lucide-react'
import { FadingVideo } from '@/components/landing/FadingVideo'
import { BlurText } from '@/components/landing/BlurText'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4'

const easeOut = [0.16, 1, 0.3, 1] as const

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[rgb(10,10,10)]"
    >
      {/* Background video */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="hero-zoom-out h-full w-full">
          <FadingVideo
            src={VIDEO_SRC}
            className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 object-cover object-center"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-24 text-center">
        {/* Badge */}
        <motion.div
          initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: easeOut }}
          className="inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 liquid-glass-dark"
        >
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[rgb(10,10,10)]">
            New
          </span>
          <span className="text-sm text-white/90">
            AI Ad Campaigns That Actually Launch on Google &amp; Meta
          </span>
        </motion.div>

        {/* Headline */}
        <div className="mt-6 max-w-3xl">
          <BlurText
            text="Your first ad campaign. Done by AI. Live in minutes."
            className="font-heading text-6xl leading-[0.85] tracking-[-3px] text-white md:text-7xl lg:text-[5.5rem]"
          />
        </div>

        {/* Subheading */}
        <motion.p
          initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8, ease: easeOut }}
          className="mt-4 max-w-2xl font-body text-sm font-light leading-relaxed text-white/80 md:text-base"
        >
          Growzzy OS is the AI marketing co-pilot built for solo founders and small teams.
          Describe your product, set your budget — we handle the creatives, targeting, and
          publishing across Google and Meta.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.1, ease: easeOut }}
          className="mt-8 flex items-center gap-6"
        >
          <a
            href="/auth"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white liquid-glass-dark-strong"
          >
            Start for Free
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2 font-body text-sm text-white/70 transition-colors hover:text-white"
          >
            See how it works
            <Play className="h-4 w-4 fill-current" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
