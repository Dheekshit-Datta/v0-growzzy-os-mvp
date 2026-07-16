"use client"

import { motion } from "framer-motion"
import { ArrowUpRight } from "./Icons"

const steps = [
  {
    n: "01",
    title: "Describe Your Product",
    body: "Tell Growzzy what you're selling, who your customer is, and what you want — more signups, sales, or app installs. Takes 2 minutes.",
  },
  {
    n: "02",
    title: "AI Builds Everything",
    body: "Growzzy generates your ad creatives, headlines, audience targeting, and bidding strategy for both Google and Meta — ready to review before anything goes live.",
  },
  {
    n: "03",
    title: "Launch and Let It Run",
    body: "One click publishes your campaigns. Growzzy monitors performance daily, reallocates budget to winning ads, and pauses what isn't working.",
  },
]

const anim = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: "easeOut" as const },
}

export function HowItWorks() {
  return (
    <section className="bg-black px-8 md:px-16 lg:px-20 py-32">
      <motion.div {...anim} className="text-sm font-body text-white/60 tracking-widest uppercase mb-6">
        // How It Works
      </motion.div>
      <motion.h2
        {...anim}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        className="font-heading italic text-white text-6xl md:text-7xl tracking-[-3px] leading-[0.9] mb-20"
      >
        Three steps.
        <br />
        Zero guesswork.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.15 }}
          >
            <div className="border-t border-white/10 pt-6">
              <div className="font-heading italic text-white/10 text-[7rem] leading-none tracking-[-4px]">
                {s.n}
              </div>
              <h3 className="font-heading italic text-white text-3xl tracking-[-1px] mt-2">
                {s.title}
              </h3>
              <p className="font-body text-sm text-white/60 font-light leading-relaxed mt-3 max-w-[28ch]">
                {s.body}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div {...anim} className="flex justify-center mt-20">
        <a href="/auth" className="liquid-glass-strong rounded-full px-8 py-3 text-sm font-medium text-white inline-flex items-center gap-2">
          Try it free — no card needed <ArrowUpRight className="h-4 w-4" />
        </a>
      </motion.div>
    </section>
  )
}
