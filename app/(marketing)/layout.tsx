import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Instrument_Serif, Inter } from "next/font/google"
import { Navbar } from "@/components/landing/Navbar"
import { Footer } from "@/components/landing/Footer"

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const inter = Inter({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "GrowzzyOS - AI-Powered Ad Management Platform",
  description:
    "Manage Meta and Google campaigns with real-time analytics, AI optimization and forensic alerts.",
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`marketing-theme ${instrumentSerif.variable} ${inter.variable}`}>
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
