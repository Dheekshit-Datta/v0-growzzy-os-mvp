import Link from "next/link"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Legal, Compliance, and Security | GrowzzyOS",
  description: "GrowzzyOS compliance overview covering privacy, authorization, security, data controls, analytics, and tenant isolation.",
}

const sections = [
  {
    title: "Legal and Compliance",
    body: "GrowzzyOS is built for agency ad operations and is designed around GDPR, India DPDP Act, and ad-platform API policy expectations. Users remain responsible for lawful campaign operation and third-party platform compliance.",
  },
  {
    title: "Privacy Policy and Terms",
    body: "Our Privacy Policy explains what account, OAuth, campaign, analytics, and usage data we process. Our Terms of Service explain permitted use, user responsibilities, third-party API obligations, and account termination rules.",
  },
  {
    title: "Data Compliance",
    body: "Campaign data is used only to provide dashboard analytics, AI recommendations, reports, automations, and user-requested ad workflows. We do not sell user data or ad account data to third parties.",
  },
  {
    title: "Authorization and Security",
    body: "Dashboard routes require authenticated sessions. Platform integrations use OAuth authorization, scoped tokens, encrypted token storage where configured, CSRF state checks for OAuth flows, and rate limits on sensitive endpoints.",
  },
  {
    title: "Signup, Login, Reset, and Account Deletion",
    body: "Users can sign up, log in, verify email, request password reset links, reset passwords via time-limited tokens, disconnect ad platforms, and permanently delete their account from Settings.",
  },
  {
    title: "Row Level Security and Tenant Isolation",
    body: "Application-level row isolation is enforced through Prisma queries scoped by authenticated userId and integration ownership. Direct database credentials are server-only and never exposed to the browser.",
  },
  {
    title: "Analytics and Tracking",
    body: "Product analytics are used for reliability, debugging, and product improvement. We avoid using campaign data for unrelated tracking or resale, and feedback/analytics records are associated with the authenticated user only where available.",
  },
]

export default function CompliancePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="text-sm text-blue-300 hover:text-blue-200">Back to GrowzzyOS</Link>
        <div>
          <h1 className="text-4xl font-bold">Legal, Compliance, and Security</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            A transparent overview of how GROWZZY OS handles privacy, authorization, authentication, security, data compliance, tenant isolation, and analytics tracking.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} className="border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.body}</p>
            </Card>
          ))}
        </div>
        <Card className="border-blue-900/60 bg-blue-950/40 p-5 text-sm text-slate-200">
          <p>
            Need data deletion, access, or privacy support? Contact{" "}
            <a className="text-blue-300" href="mailto:privacy@growzzyos.com">privacy@growzzyos.com</a>. For legal questions, contact{" "}
            <a className="text-blue-300" href="mailto:legal@growzzyos.com">legal@growzzyos.com</a>.
          </p>
          <div className="mt-4 flex gap-4">
            <Link href="/privacy" className="text-blue-300 hover:text-blue-200">Privacy Policy</Link>
            <Link href="/terms" className="text-blue-300 hover:text-blue-200">Terms of Service</Link>
          </div>
        </Card>
      </div>
    </main>
  )
}

