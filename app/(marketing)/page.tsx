import { Nav } from "@/components/landing/Nav"
import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { AICopilot } from "@/components/landing/AICopilot"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { StatsBand } from "@/components/landing/StatsBand"
import { Testimonials } from "@/components/landing/Testimonials"
import { Pricing } from "@/components/landing/Pricing"
import { FAQ } from "@/components/landing/FAQ"
import { CTA } from "@/components/landing/CTA"
import { Footer } from "@/components/landing/Footer"

export default function MarketingLandingPage() {
  return (
    <main className="min-h-screen px-3 py-4 md:px-6 md:py-8">
      <div
        className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Nav />
        <Hero />
        <Features />
        <AICopilot />
        <HowItWorks />
        <StatsBand />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
        <Footer />
      </div>
    </main>
  )
}

