"use client"

import { motion } from "framer-motion"

const starter = [
  "2 active campaigns",
  "Google Ads + Meta",
  "AI creative generation",
  "Basic performance dashboard",
  "1 ad account per platform",
]

const growth = [
  "Unlimited campaigns",
  "Google Ads + Meta",
  "AI creative studio (all formats)",
  "Optimization autopilot",
  "Advanced analytics",
  "Priority support",
  "Multiple ad accounts",
]

const anim = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: "easeOut" as const },
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f} className="font-body text-sm text-white/70 font-light flex gap-3">
          <span className="text-white">✦</span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="bg-black px-8 md:px-16 lg:px-20 py-32">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div {...anim} className="text-sm font-body text-white/60 tracking-widest uppercase mb-6">
          // Pricing
        </motion.div>
        <motion.h2
          {...anim}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="font-heading italic text-white text-6xl md:text-7xl tracking-[-3px] leading-[0.9] mb-4"
        >
          Simple.
          <br />
          No surprises.
        </motion.h2>
        <motion.p
          {...anim}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          className="font-body text-sm text-white/50 font-light mb-16"
        >
          Start free. Upgrade when you're ready. Cancel any time.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
            className="liquid-glass rounded-[1.25rem] p-8"
          >
            <div className="font-body text-xs text-white/50 uppercase tracking-widest font-medium">
              Starter
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <div className="font-heading italic text-white text-6xl tracking-[-2px]">$0</div>
              <div className="font-body text-sm text-white/40">forever</div>
            </div>
            <div className="border-t border-white/10 my-6" />
            <FeatureList items={starter} />
            <a href="/auth" className="liquid-glass rounded-full block w-full text-center py-3 text-sm text-white font-medium mt-8">
              Get started free
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
            className="liquid-glass-strong rounded-[1.25rem] p-8 relative"
          >
            <span className="liquid-glass rounded-full absolute top-4 right-4 px-3 py-1 text-[11px] text-white/90 font-body">
              Most popular
            </span>
            <div className="font-body text-xs text-white/50 uppercase tracking-widest font-medium">
              Growth
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <div className="font-heading italic text-white text-6xl tracking-[-2px]">$49</div>
              <div className="font-body text-sm text-white/40">/month</div>
            </div>
            <div className="border-t border-white/10 my-6" />
            <FeatureList items={growth} />
            <a href="/auth" className="rounded-full block w-full text-center py-3 text-sm font-medium bg-white text-black mt-8">
              Start 14-day free trial
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
