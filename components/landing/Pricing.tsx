'use client'

import { motion } from 'framer-motion'

const easeOut = [0.16, 1, 0.3, 1] as const

const STARTER_FEATURES = [
  '2 active campaigns',
  'Google Ads + Meta',
  'AI creative generation',
  'Basic performance dashboard',
  '1 ad account per platform',
]

const GROWTH_FEATURES = [
  'Unlimited campaigns',
  'Google Ads + Meta',
  'AI creative studio (all formats)',
  'Optimization autopilot',
  'Advanced analytics',
  'Priority support',
  'Multiple ad accounts',
]

export function PricingSection() {
  return (
    <section id="pricing" className="bg-white px-8 py-32">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <p className="mb-6 font-body text-sm uppercase tracking-widest text-neutral-500">
            // Pricing
          </p>
          <h2 className="mb-4 font-heading text-6xl leading-[0.9] tracking-[-3px] text-neutral-900 md:text-7xl">
            Simple.
            <br />
            No surprises.
          </h2>
          <p className="mb-16 text-sm font-light text-neutral-500">
            Start free. Upgrade when you&apos;re ready. Cancel any time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-2">
          {/* Starter */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: easeOut }}
            className="rounded-[1.25rem] p-8 liquid-glass-light"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Starter
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-heading text-6xl tracking-[-2px] text-neutral-900">$0</span>
              <span className="mb-2 text-sm text-neutral-400">forever</span>
            </div>
            <div className="my-6 border-t border-neutral-200" />
            <ul className="space-y-3">
              {STARTER_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm font-light text-neutral-700">
                  <span className="text-neutral-400">✦</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/auth"
              className="mt-8 block w-full rounded-full py-3 text-center text-sm font-medium text-neutral-900 liquid-glass-light"
            >
              Get started free
            </a>
          </motion.div>

          {/* Growth */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: easeOut }}
            className="relative rounded-[1.25rem] p-8 liquid-glass-light-strong"
          >
            <span className="absolute right-6 top-6 rounded-full px-3 py-1 text-[11px] text-neutral-900 liquid-glass-light">
              Most popular
            </span>
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Growth
            </p>
            <div className="mt-2 flex items-end gap-1">
              <span className="font-heading text-6xl tracking-[-2px] text-neutral-900">$49</span>
              <span className="mb-2 text-sm text-neutral-400">/month</span>
            </div>
            <div className="my-6 border-t border-neutral-200" />
            <ul className="space-y-3">
              {GROWTH_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm font-light text-neutral-700">
                  <span className="text-neutral-400">✦</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/auth"
              className="mt-8 block w-full rounded-full bg-neutral-900 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Start 14-day free trial
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
