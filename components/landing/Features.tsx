"use client"

import type { ComponentType } from "react"
import { motion } from "framer-motion"
import { ImageIcon, LaunchIcon, AutoGraphIcon } from "./Icons"

type Card = {
  icon: ComponentType<{ className?: string }>
  tags: string[]
  title: string
  body: string
}

const cards: Card[] = [
  {
    icon: ImageIcon,
    tags: ["Google Ready", "Meta Ready", "On-Brand", "Auto-Sized"],
    title: "AI Creative Studio",
    body: "Describe your product in plain English. Growzzy generates scroll-stopping ad creatives — headlines, copy, and visuals — sized perfectly for every Google and Meta placement.",
  },
  {
    icon: LaunchIcon,
    tags: ["No Setup", "Live in 3 Min", "Budget Safe", "Auto-Optimize"],
    title: "One-Click Launch",
    body: "Set your goal, daily budget, and audience — Growzzy publishes your campaign directly to Google Ads and Meta with the right objective, bidding strategy, and targeting. No agency needed.",
  },
  {
    icon: AutoGraphIcon,
    tags: ["Daily Signals", "Auto-Pause", "Budget Guard", "ROAS Focus"],
    title: "Optimization Autopilot",
    body: "Growzzy watches your campaigns 24/7. It spots underperforming ads, reallocates budget to winners, and alerts you before money is wasted — or acts automatically if you want full autopilot.",
  },
]

export function Features() {
  return (
    <section id="features" className="relative min-h-screen w-full overflow-hidden bg-black">
      <div className="relative z-10 px-8 md:px-16 lg:px-20 pt-24 pb-10 flex flex-col min-h-screen">
        <div className="mb-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-sm font-body text-white/70 mb-6 tracking-widest uppercase"
          >
            // What Growzzy Does
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="font-heading italic text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]"
          >
            Marketing
            <br />
            on autopilot.
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {cards.map(({ icon: Icon, tags, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.15 }}
              className="liquid-glass rounded-[1.25rem] p-6 min-h-[380px] flex flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="liquid-glass w-11 h-11 rounded-[0.75rem] flex items-center justify-center">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[65%]">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="liquid-glass rounded-full px-3 py-1 text-[11px] text-white/80 font-body whitespace-nowrap"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-auto">
                <h3 className="font-heading italic text-white text-3xl md:text-4xl leading-none tracking-[-1px]">
                  {title}
                </h3>
                <p className="mt-3 text-sm text-white/75 font-body font-light leading-relaxed">
                  {body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
