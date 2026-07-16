"use client"

import { motion } from "framer-motion"
import { ArrowUpRight } from "./Icons"

export function CTA() {
  return (
    <section className="bg-black px-8 md:px-16 lg:px-20 py-40 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="font-heading italic text-white text-6xl md:text-8xl lg:text-[7rem] tracking-[-4px] leading-[0.85] max-w-4xl mx-auto"
      >
        Your first campaign
        <br />
        could be live
        <br />
        tonight.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        className="font-body text-base text-white/50 font-light mt-8 max-w-xl mx-auto leading-relaxed"
      >
        No agency. No guesswork. No wasted budget. Just describe your product and let Growzzy do the rest.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
        className="mt-10 flex flex-col items-center"
      >
        <a href="/auth" className="liquid-glass-strong rounded-full px-10 py-4 text-base font-medium text-white inline-flex items-center gap-2">
          Start for free <ArrowUpRight className="h-4 w-4" />
        </a>
        <p className="font-body text-xs text-white/30 font-light mt-4">
          Free forever · No credit card · Cancel anytime
        </p>
      </motion.div>
    </section>
  )
}
