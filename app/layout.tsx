import type React from "react"
import type { Metadata } from "next"
import { Inter, Instrument_Serif } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://growzzyos.vercel.app"),
  title: "GROWZZY OS - Unified AI-Powered Marketing Operations Platform",
  description:
    "Create, publish, monitor, and optimize Google Ads campaigns with an AI-assisted workflow and verified campaign data.",
  openGraph: {
    title: "Growzzy OS - AI ad campaigns that actually launch",
    description:
      "Create, publish, monitor, and optimize Google Ads campaigns with an AI-assisted workflow and verified campaign data.",
    url: "/",
    siteName: "Growzzy OS",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Growzzy OS" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Growzzy OS - AI ad campaigns that actually launch",
    description:
      "Create, publish, monitor, and optimize Google Ads campaigns with an AI-assisted workflow and verified campaign data.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  generator: "v0.app",
}

import { Providers } from "./providers"

// ... existing imports ...

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} antialiased`}>
      <head>
        {/* ... existing head ... */}
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
