'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const easeOut = [0.16, 1, 0.3, 1] as const

const FAQS = [
  {
    q: 'Do I need a Google Ads account first?',
    a: "Yes. You'll connect and select an existing Google Ads account during onboarding. Meta support is planned but is not active today.",
  },
  {
    q: 'Will Growzzy spend my budget without my approval?',
    a: "Never on the first launch. You review everything before it goes live. On autopilot mode, Growzzy only reallocates within your set daily budget — it can't spend more than you've approved.",
  },
  {
    q: 'What if I sell a physical product? Or a SaaS? Or a service?',
    a: 'All of the above. Growzzy works for any product type. You describe what you sell and who buys it — the AI adapts the creative and targeting strategy accordingly.',
  },
  {
    q: 'How is this different from using Google Ads directly?',
    a: 'Those tools are built for experts. Growzzy handles the strategy, creative, and optimization automatically — you just set your goal and budget. Most founders go live in under 10 minutes versus days of setup.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no cancellation fees. If you downgrade to free, your campaigns pause — they don’t delete.',
  },
  {
    q: "What does 'optimization autopilot' actually do?",
    a: 'It checks your campaign performance daily. If an ad is underperforming, it pauses it. If one is winning, it shifts more budget toward it. You get a weekly summary of everything it changed and why.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="mx-auto max-w-3xl bg-white px-8 py-32 md:px-16 lg:px-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOut }}
      >
        <p className="mb-6 font-body text-sm uppercase tracking-widest text-neutral-500">// FAQ</p>
        <h2 className="mb-12 font-heading text-6xl leading-[0.9] tracking-[-3px] text-neutral-900 md:text-7xl">
          Everything
          <br />
          you&apos;re wondering.
        </h2>
      </motion.div>

      <div>
        {FAQS.map((faq, i) => {
          const isOpen = open === i
          return (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: easeOut }}
              onClick={() => setOpen(isOpen ? null : i)}
              className="mb-3 cursor-pointer rounded-[1rem] px-6 py-5 liquid-glass-light"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-neutral-900">{faq.q}</span>
                <span className="flex-shrink-0 text-neutral-900">
                  {isOpen ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p className="pt-3 text-sm font-light leading-relaxed text-neutral-600">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
