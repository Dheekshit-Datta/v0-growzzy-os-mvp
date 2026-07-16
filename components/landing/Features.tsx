'use client'

import { motion } from 'framer-motion'
import { Wand2, Rocket, Gauge, type LucideIcon } from 'lucide-react'

const easeOut = [0.16, 1, 0.3, 1] as const

interface Feature {
  icon: LucideIcon
  tags: string[]
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    icon: Wand2,
    tags: ['Google Ready', 'Meta Ready', 'On-Brand', 'Auto-Sized'],
    title: 'AI Creative Studio',
    body: 'Describe your product in plain English. Growzzy generates scroll-stopping ad creatives — headlines, copy, and visuals — sized perfectly for every Google and Meta placement.',
  },
  {
    icon: Rocket,
    tags: ['No Setup', 'Live in 3 Min', 'Budget Safe', 'Auto-Optimize'],
    title: 'One-Click Launch',
    body: 'Set your goal, daily budget, and audience — Growzzy publishes your campaign directly to Google Ads and Meta with the right objective, bidding strategy, and targeting. No agency needed.',
  },
  {
    icon: Gauge,
    tags: ['Daily Signals', 'Auto-Pause', 'Budget Guard', 'ROAS Focus'],
    title: 'Optimization Autopilot',
    body: 'Growzzy watches your campaigns 24/7. It spots underperforming ads, reallocates budget to winners, and alerts you before money is wasted — or acts automatically if you want full autopilot.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white px-8 py-32 md:px-16 lg:px-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: easeOut }}
      >
        <p className="mb-6 font-body text-sm uppercase tracking-widest text-neutral-500">
          // What Growzzy Does
        </p>
        <h2 className="font-heading text-6xl leading-[0.9] tracking-[-3px] text-neutral-900 md:text-7xl lg:text-[6rem]">
          Marketing
          <br />
          on autopilot.
        </h2>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {FEATURES.map((feature, i) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: easeOut }}
              className="flex min-h-[380px] flex-col rounded-[1.25rem] p-6 liquid-glass-light"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[0.75rem] liquid-glass-light">
                  <Icon className="h-6 w-6 text-neutral-900" strokeWidth={1.5} />
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-1 text-[11px] text-neutral-700 liquid-glass-light"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <h3 className="mt-6 font-heading text-3xl text-neutral-900">{feature.title}</h3>
              <p className="mt-3 text-sm font-light leading-relaxed text-neutral-600">
                {feature.body}
              </p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
