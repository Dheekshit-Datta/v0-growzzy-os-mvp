"use client"

import { motion } from "framer-motion"
import { FadingVideo } from "./FadingVideo"
import { BlurText } from "./BlurText"
import { Navbar } from "./Navbar"
import { ArrowUpRight, Play, ClockIcon, TrendingUpIcon, RocketIcon } from "./Icons"

const fadeInitial = { filter: "blur(10px)", opacity: 0, y: 20 }
const fadeAnimate = { filter: "blur(0px)", opacity: 1, y: 0 }

const stats = [
  { icon: ClockIcon, value: "3 Min", label: "Average time to first live ad" },
  { icon: TrendingUpIcon, value: "68%", label: "Lower cost-per-click vs manual" },
  { icon: RocketIcon, value: "$0", label: "Required to start — free forever" },
]

const brands = ["Ripple", "Stackr", "Folio", "Vibe", "Arcly"]

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"

export function Hero() {
  return (
    <section id="home" className="relative min-h-screen w-full overflow-hidden bg-black">
      <FadingVideo
        src={HERO_VIDEO}
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <div className="flex-1 flex flex-col items-center justify-center text-center pt-24 px-4">
          <motion.div
            initial={fadeInitial}
            animate={fadeAnimate}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }}
            className="liquid-glass rounded-full inline-flex items-center gap-2 pl-1 pr-3 py-1 mb-8"
          >
            <span className="bg-white text-black px-3 py-1 text-xs font-semibold rounded-full">
              New
            </span>
            <span className="text-sm text-white/90 font-body">
              AI Ad Campaigns That Actually Launch on Google &amp; Meta
            </span>
          </motion.div>

          <BlurText
            text="Your first ad campaign. Done by AI. Live in minutes."
            className="text-6xl md:text-7xl lg:text-[5.5rem] font-heading italic text-white leading-[0.85] max-w-3xl tracking-[-3px]"
          />

          <motion.p
            initial={fadeInitial}
            animate={fadeAnimate}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.8 }}
            className="mt-4 text-sm md:text-base text-white/80 max-w-2xl font-body font-light leading-relaxed"
          >
            Growzzy OS is the AI marketing co-pilot built for solo founders and small teams.
            Describe your product, set your budget — we handle the creatives, targeting, and
            publishing across Google and Meta.
          </motion.p>

          <motion.div
            initial={fadeInitial}
            animate={fadeAnimate}
            transition={{ duration: 0.7, ease: "easeOut", delay: 1.1 }}
            className="flex items-center gap-6 mt-8"
          >
            <a href="/auth" className="liquid-glass-strong rounded-full px-6 py-3 text-sm font-medium text-white inline-flex items-center gap-2">
              Start for Free <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href="#features" className="text-white/70 text-sm font-body inline-flex items-center gap-2">
              See how it works <Play className="h-4 w-4" />
            </a>
          </motion.div>

          <motion.div
            initial={fadeInitial}
            animate={fadeAnimate}
            transition={{ duration: 0.7, ease: "easeOut", delay: 1.3 }}
            className="flex flex-wrap justify-center items-stretch gap-4 mt-10"
          >
            {stats.map(({ icon: Icon, value, label }) => (
              <div
                key={value}
                className="liquid-glass p-5 w-[200px] rounded-[1.25rem] flex flex-col items-start text-left"
              >
                <Icon className="h-7 w-7 text-white" />
                <div className="text-4xl tracking-[-1px] leading-none font-heading italic text-white mt-3">
                  {value}
                </div>
                <div className="text-xs text-white/70 font-body font-light mt-2">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={fadeInitial}
          animate={fadeAnimate}
          transition={{ duration: 0.7, ease: "easeOut", delay: 1.4 }}
          className="flex flex-col items-center gap-4 pb-8 px-4"
        >
          <div className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white/80 font-body">
            Trusted by founders building the next big thing
          </div>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {brands.map((b) => (
              <span
                key={b}
                className="text-2xl md:text-3xl tracking-tight font-heading italic text-white"
              >
                {b}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
