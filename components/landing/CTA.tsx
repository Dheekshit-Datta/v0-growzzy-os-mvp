'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const easeOut = [0.16, 1, 0.3, 1] as const

export function FinalCtaSection() {
  return (
    <section className="bg-white px-8 py-40 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOut }}
        className="flex flex-col items-center"
      >
        <h2 className="mx-auto max-w-4xl font-heading text-6xl leading-[0.85] tracking-[-4px] text-neutral-900 md:text-8xl lg:text-[7rem]">
          Your first campaign
          <br />
          could be live
          <br />
          tonight.
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-base font-light leading-relaxed text-neutral-500">
          No agency. No guesswork. No wasted budget. Just describe your product and let Growzzy
          do the rest.
        </p>
        <a
          href="/auth"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[rgb(10,10,10)] px-10 py-4 text-base font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Start for free
          <ArrowUpRight className="h-5 w-5" />
        </a>
        <p className="mt-4 font-body text-xs font-light text-neutral-400">
          Free forever · No credit card · Cancel anytime
        </p>
      </motion.div>
    </section>
  )
}
