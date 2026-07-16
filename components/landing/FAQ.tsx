"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const items = [
  {
    q: "Do I need a Google Ads or Meta account first?",
    a: "Yes, you'll connect your existing accounts during onboarding. If you don't have one yet, we walk you through creating it — it takes about 5 minutes per platform.",
  },
  {
    q: "Will Growzzy spend my budget without my approval?",
    a: "Never on the first launch. You review everything before it goes live. On autopilot mode, Growzzy only reallocates within your set daily budget — it can't spend more than you've approved.",
  },
  {
    q: "What if I sell a physical product? Or a SaaS? Or a service?",
    a: "All of the above. Growzzy works for any product type. You describe what you sell and who buys it — the AI adapts the creative and targeting strategy accordingly.",
  },
  {
    q: "How is this different from just using Google Ads or Meta directly?",
    a: "Those tools are built for experts. Growzzy handles the strategy, creative, and optimization automatically — you just set your goal and budget. Most founders go live in under 10 minutes versus days of setup.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees. If you downgrade to free, your campaigns pause — they don't delete.",
  },
  {
    q: "What does 'optimization autopilot' actually do?",
    a: "It checks your campaign performance daily. If an ad is underperforming, it pauses it. If one is winning, it shifts more budget toward it. You get a weekly summary of everything it changed and why.",
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="bg-black px-8 md:px-16 lg:px-20 py-32">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-sm font-body text-white/60 tracking-widest uppercase mb-6"
        >
          // FAQ
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="font-heading italic text-white text-6xl md:text-7xl tracking-[-3px] leading-[0.9] mb-16"
        >
          Everything
          <br />
          you're wondering.
        </motion.h2>

        <div>
          {items.map((it, i) => {
            const isOpen = open === i
            return (
              <motion.div
                key={it.q}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.05 }}
                className="liquid-glass rounded-[1rem] px-5 sm:px-6 py-5 mb-3 cursor-pointer"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-body text-sm font-medium text-white flex-1 min-w-0">
                    {it.q}
                  </div>
                  <div className="shrink-0 w-6 h-6 flex items-center justify-center text-white/50 text-xl leading-none">
                    {isOpen ? "−" : "+"}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.25, ease: "easeOut" },
                      }}
                      style={{ overflow: "hidden" }}
                    >
                      <p className="font-body text-sm text-white/60 font-light leading-relaxed pt-3">
                        {it.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
