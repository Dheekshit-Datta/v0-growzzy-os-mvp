import { HeroSection } from "@/components/landing/Hero"
import { FeaturesSection } from "@/components/landing/Features"
import { HowItWorksSection } from "@/components/landing/HowItWorks"
import { PricingSection } from "@/components/landing/Pricing"
import { FaqSection } from "@/components/landing/FAQ"
import { FinalCtaSection } from "@/components/landing/CTA"

export default function MarketingLandingPage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </main>
  )
}
