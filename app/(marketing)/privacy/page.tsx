import Link from "next/link"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Privacy Policy | GrowzzyOS",
  description:
    "GrowzzyOS Privacy Policy describing how we collect, process, protect and retain ad platform data including Google Ads API data.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-blue-300 hover:text-blue-200">
            â† Back to GrowzzyOS
          </Link>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-slate-300">Last updated: April 24, 2026</p>
        </div>

        <Card className="space-y-6 border-slate-800 bg-slate-900 p-6 leading-relaxed text-slate-200">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
            <p className="mt-2">
              GrowzzyOS (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the GrowzzyOS platform. This Privacy
              Policy describes how we collect, use, store, and protect your personal and advertising data when you use
              GrowzzyOS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Data We Collect</h2>
            <ul className="mt-2 space-y-2">
              <li>Account information such as name and email collected through OAuth login.</li>
              <li>
                Ad platform data fetched via APIs (Google Ads and Meta) on your authorized behalf.
              </li>
              <li>Usage data and product analytics required to maintain and improve the platform.</li>
              <li>Security events such as login, password reset, email verification, rate-limit, and account deletion activity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. How We Use Google Ads API Data</h2>
            <ul className="mt-2 space-y-2">
              <li>
                We access Google Ads data solely to display campaign performance metrics within your GrowzzyOS
                dashboard.
              </li>
              <li>
                We do not sell, share, or use Google Ads data for any purpose other than providing the GrowzzyOS
                service.
              </li>
              <li>Data access is governed by Google&apos;s API Services User Data Policy.</li>
              <li>Users can revoke Google Ads access at any time from Settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. How We Use Platform Data</h2>
            <ul className="mt-2 space-y-2">
              <li>
                We access Meta and Google data only to provide campaign analytics, reporting, and
                optimization workflows requested by users.
              </li>
              <li>
                We do not sell, share, or process this data for unrelated advertising or data brokerage purposes.
              </li>
              <li>Users can disconnect these platforms at any time from Settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Data Storage</h2>
            <p className="mt-2">
              Data is stored securely in an encrypted PostgreSQL database on Vercel infrastructure with access controls
              and audit logging.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Data Sharing</h2>
            <p className="mt-2">We do not sell or share user data with third parties for commercial resale.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Data Retention</h2>
            <p className="mt-2">
              Data is retained while your account is active and deleted within 30 days of account deletion, except
              where longer retention is legally required.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. User Rights</h2>
            <p className="mt-2">
              You may request access, correction, or deletion of your personal data by contacting us at the email
              address below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Cookies</h2>
            <p className="mt-2">We use session cookies only for authentication and essential platform functionality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">10. Authorization, Security, and Row Isolation</h2>
            <p className="mt-2">
              GrowzzyOS protects dashboard data behind authenticated sessions and scopes server-side Prisma queries by
              authenticated user ownership. Platform authorization uses OAuth scopes requested from Google and
              other enabled providers. Sensitive flows such as signup, password reset, email verification, and feedback
              are rate-limited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">11. Account Deletion</h2>
            <p className="mt-2">
              Users can request deletion from Settings. Account deletion removes the user account and associated
              integrations, campaigns, leads, reports, automations, and settings, except records we must retain for legal
              or security reasons.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">12. Analytics and Tracking</h2>
            <p className="mt-2">
              We use limited product analytics and feedback data to understand reliability, usage, and beta issues. We do
              not sell campaign data or use ad platform data for unrelated behavioral advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">13. Contact</h2>
            <p className="mt-2">
              For privacy requests, email{" "}
              <a className="text-blue-300 hover:text-blue-200" href="mailto:privacy@growzzyos.com">
                privacy@growzzyos.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">14. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy periodically. Users will be notified of material changes through the
              platform or email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">15. Compliance</h2>
            <p className="mt-2">GrowzzyOS is designed to support GDPR and India DPDP Act compliance obligations.</p>
          </section>
        </Card>
      </div>
    </main>
  )
}
