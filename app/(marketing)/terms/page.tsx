import Link from "next/link"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Terms of Service | GrowzzyOS",
  description:
    "Terms of Service for GrowzzyOS including acceptable use, account obligations, API platform compliance, and liability limits.",
}

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-blue-300 hover:text-blue-200">
            â† Back to GrowzzyOS
          </Link>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-sm text-slate-300">Last updated: April 24, 2026</p>
        </div>

        <Card className="space-y-6 border-slate-800 bg-slate-900 p-6 leading-relaxed text-slate-200">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By using GrowzzyOS, you agree to these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Description of Service</h2>
            <p className="mt-2">
              GrowzzyOS is an ad management and analytics platform that helps agencies and teams monitor and optimize
              campaigns across integrated ad channels.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. User Accounts</h2>
            <p className="mt-2">
              You are responsible for maintaining account confidentiality, verifying your email, protecting password
              reset links, and for all activities under your account. You may request deletion of your account from
              Settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Permitted Use</h2>
            <p className="mt-2">
              You agree to use GrowzzyOS only for lawful purposes. Reverse engineering, abuse, unauthorized access
              attempts, or use that violates applicable law is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Third Party API Use</h2>
            <ul className="mt-2 space-y-2">
              <li>Users must comply with Google Ads API Terms of Service.</li>
              <li>Users must comply with Meta Platform Terms.</li>
              <li>GrowzzyOS accesses these APIs on behalf of users with their explicit authorization.</li>
              <li>Users may revoke platform authorization from GrowzzyOS Settings or directly from the third-party platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Security and Rate Limiting</h2>
            <p className="mt-2">
              GrowzzyOS may apply rate limits, OAuth state validation, email verification, password reset tokens, access
              controls, tenant-scoped queries, logging, and other safeguards to protect the service and users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Data and Privacy</h2>
            <p className="mt-2">
              Your use of GrowzzyOS is also governed by our{" "}
              <Link href="/privacy" className="text-blue-300 hover:text-blue-200">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Intellectual Property</h2>
            <p className="mt-2">
              GrowzzyOS and all related software, branding, and content are owned by GrowzzyOS and protected by
              intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Limitation of Liability</h2>
            <p className="mt-2">
              GrowzzyOS is provided on an &quot;as is&quot; basis. To the maximum extent permitted by law, GrowzzyOS
              is not liable for indirect, incidental, special, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">10. Termination</h2>
            <p className="mt-2">
              We may suspend or terminate access for violations of these terms or abuse of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">11. Governing Law</h2>
            <p className="mt-2">These Terms are governed by the laws of India.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">12. Contact Information</h2>
            <p className="mt-2">
              For legal or terms-related questions, contact{" "}
              <a className="text-blue-300 hover:text-blue-200" href="mailto:legal@growzzyos.com">
                legal@growzzyos.com
              </a>
              .
            </p>
          </section>
        </Card>
      </div>
    </main>
  )
}
