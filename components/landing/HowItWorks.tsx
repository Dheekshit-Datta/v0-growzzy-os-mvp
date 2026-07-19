'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const easeOut = [0.16, 1, 0.3, 1] as const

const STEPS = [
  {
    number: '01',
    title: 'Create your identity',
    body: "Set up your workspace and tell Growzzy what you're selling, who your customer is, and what success looks like — more signups, sales, or app installs. Takes 2 minutes.",
  },
  {
    number: '02',
    title: 'Configure your workspace',
    body: 'Growzzy generates your Google Search headlines, keywords, targeting, and bidding strategy, ready to review before anything is published.',
  },
  {
    number: '03',
    title: 'Connect your advertising',
    body: 'Connect Google Ads, select your account, and sync real campaign data. Meta remains disabled until its full backend is ready.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how" className="bg-white px-8 py-32 md:px-16 lg:px-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOut }}
      >
        <p className="mb-6 font-body text-sm uppercase tracking-widest text-neutral-500">
          // How It Works
        </p>
        <h2 className="mb-20 font-heading text-6xl leading-[0.9] tracking-[-3px] text-neutral-900 md:text-7xl">
          Three steps.
          <br />
          Zero guesswork.
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.1, ease: easeOut }}
            className="border-t border-neutral-200 pt-6"
          >
            <div className="font-heading text-[7rem] leading-none tracking-[-4px] text-neutral-200">
              {step.number}
            </div>
            <h3 className="mt-2 font-heading text-3xl text-neutral-900">{step.title}</h3>
            <p className="mt-3 max-w-[28ch] text-sm font-light leading-relaxed text-neutral-600">
              {step.body}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOut }}
        className="mt-20 flex justify-center"
      >
        <a
          href="/auth"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-neutral-900 liquid-glass-light-strong"
        >
          Try it free — no card needed
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </motion.div>
    </section>
  )
}
