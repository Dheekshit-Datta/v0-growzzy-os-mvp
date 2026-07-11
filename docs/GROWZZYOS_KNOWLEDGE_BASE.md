# GROWZZY OS Knowledge Base

Last updated: May 13, 2026

## 1. What GROWZZY OS Is

GROWZZY OS is an AI-powered ad management, analytics, optimization, and agency workspace built for SMMA teams and performance marketing agencies. It centralizes campaign data, platform connections, AI recommendations, creative generation, reporting, leads, automations, and operational settings in one dashboard.

The product goal is simple: help agencies move from scattered ad accounts and manual reporting into one workspace where they can connect platforms, understand performance, act on AI recommendations, and manage campaign workflows faster.

## 2. Core Product Pillars

### Unified Ad Workspace

GROWZZY OS connects supported ad platforms and normalizes campaign metrics into one schema. Current platform surfaces are:

- Google Ads: active production integration.
- LinkedIn Ads: integration-ready when the app and account have approved permissions.
- Meta Ads: OAuth and account discovery support, subject to Meta app permissions and review status.

### AI Growth Assistant

The AI Growth Assistant is a contextual chat interface for campaign analysis. It reads the user campaign data from the database and answers questions about campaign names, spend, impressions, clicks, conversions, CPC, CTR, ROAS, and budget performance.

Examples:

- “Which campaign has the best ROAS?”
- “Where should I move budget?”
- “Which campaign is wasting spend?”
- “Generate a performance summary.”

### AI Ad Creatives

The AI Ad Creatives section helps generate ad copy and creative directions. It can produce campaign-specific headlines, descriptions, CTAs, and ad preview content. Image generation depends on the configured AI image provider and available API keys.

### AI Optimization

AI Optimization analyzes campaign data and generates recommendations such as budget increases, budget reductions, creative refreshes, bid adjustments, or campaign pause suggestions. Recommendations should reference actual campaign names and numbers.

### Campaign Matrix

Campaign Matrix is the operational table for campaigns. It shows platform, status, live/draft state, budget, spend, impressions, clicks, conversions, CTR, CPC, and ROAS. Search and filters help agencies manage campaign portfolios.

### Analytics

Analytics shows performance trends, channel-level breakdowns, efficiency views, and charts. The data rule is strict: a platform can only show metrics if that platform is connected and has ad access. Disconnected platforms should show a locked or connect-to-unlock state, never dummy metrics.

### Automations

Automations are rule-based workflows for alerts and campaign operations. Examples include low ROAS alerts, budget pacing alerts, weekly reports, and conversion drop alerts. Production rules should be persisted in the database and execution should be logged.

### Reports

Reports generate agency-ready PDFs using campaign data. Reports should include date range, KPI summary, campaign breakdown, charts, and GROWZZY OS branding.

### Leads / Target Index

The leads module stores prospects and pipeline data. It supports lead creation, search, status changes, notes, value tracking, and AI lead scoring where configured.

## 3. Main User Journey

1. User signs up or logs in.
2. User connects an ad platform from Settings > Platform Bridges.
3. GROWZZY OS discovers available ad accounts.
4. User selects or confirms the primary ad account.
5. User syncs campaigns.
6. Dashboard and analytics populate with connected-platform data only.
7. User runs AI audit or asks the AI Growth Assistant questions.
8. User creates reports, creatives, automation rules, and leads.

## 4. Authentication And Accounts

GROWZZY OS uses NextAuth with Prisma/PostgreSQL. Supported auth flows include:

- Email and password login.
- Signup.
- Google OAuth sign-in where configured.
- Password reset flow.
- Email verification flow.
- Account deletion flow.

Sessions should persist long enough for beta use and protected dashboard routes should require authentication.

## 5. Platform Integrations

### Google Ads

Google Ads is the primary production integration. GROWZZY OS uses OAuth to request access to Google Ads data and Google identity information. Required scope includes:

- `https://www.googleapis.com/auth/adwords`
- Google email/profile identity scopes as configured

Google Ads account discovery uses the Google Ads API with the configured developer token. Campaign sync stores metrics such as impressions, clicks, spend, conversions, CTR, CPC, and ROAS.

Common Google Ads issues:

- `403 authorizationError`: the user token does not have access to that customer hierarchy, or the developer token/account setup is mismatched.
- `404 Unknown Google Ads API error`: usually caused by wrong customer ID, wrong login-customer-id, inaccessible account, or unsupported API/version/account relationship.
- Connected but pending sync: OAuth succeeded but campaign sync failed or has not run.

### LinkedIn Ads

LinkedIn Ads uses OAuth and the LinkedIn Ads APIs. Requests must include:

- `X-Restli-Protocol-Version: 2.0.0`

LinkedIn account IDs are URNs and must not be mangled. If no LinkedIn ad accounts are returned, the UI should show a clear no-account/connect guidance state.

### Meta Ads

Meta Ads uses Meta OAuth and the Graph API. Typical permissions include:

- `ads_read`
- `ads_management`
- `business_management`

Meta integration requires:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- A Meta app configured with the exact redirect URI
- User access to at least one Meta ad account
- Approved permissions depending on production app mode and use case

Meta ad account IDs are generally stored as `act_<account_id>`.

## 6. Data Model Overview

Important models include:

- `User`: account, auth, onboarding, email verification, reset state.
- `Integration`: one platform connection per user and platform.
- `AdAccount`: discovered ad accounts for each integration.
- `Campaign`: normalized campaign records and metrics.
- `AdGroup`, `Keyword`, `Ad`: hierarchy for campaign creation workflows.
- `Lead`: CRM-style lead records.
- `AutomationRule`, `AutomationLog`: persisted automation rules and execution history.
- `AccountAudit`, `OptimizationLog`: AI audit and applied recommendation history.
- `GeneratedCreative`: AI creative records.
- `Notification`: user notifications.
- `BetaFeedback`, `BetaWaitlist`: beta feedback and platform waitlists.

## 7. Data Safety Rules

GROWZZY OS must follow these rules:

- Never show dummy metrics for a disconnected platform.
- Never expose access tokens, refresh tokens, secrets, cookies, or raw authorization headers in logs.
- Never mutate ad campaigns without explicit user action.
- Always show clear empty, syncing, and error states.
- Always disable async action buttons while the action is in progress.
- Always provide disconnect/revoke options for integrations.

## 8. Security And Compliance

Security posture:

- Tokens are stored server-side and should be encrypted where supported.
- Auth routes are protected by session checks.
- API routes that require a user must verify the session.
- Rate limiting should protect auth, AI, sync, and public endpoints.
- Logs must redact sensitive fields.
- Account deletion should remove or anonymize user-owned data as required.

Compliance pages:

- Public Privacy Policy.
- Public Terms of Service.
- Public Compliance / Data usage page.
- Clear Google Ads API usage explanation on public pages.

## 9. Operational Monitoring

Recommended production monitoring:

- `/api/health` for database and service readiness.
- Structured logs through the application logger.
- Sync status and sync errors stored on integrations/ad accounts.
- User-facing error messages for failed syncs, token expiry, and access issues.
- Cron jobs for background sync and automation execution.

## 10. Beta Launch Expectations

For beta, the app should:

- Let a user sign up, log in, reset password, verify email, and delete account.
- Let a user connect Google Ads and Meta Ads where credentials/permissions are valid.
- Show empty states instead of fake data.
- Generate contextual AI answers from real campaign data.
- Generate PDF reports.
- Persist leads and automations.
- Capture user feedback.
- Avoid blank screens and uncaught client-side exceptions.

## 11. Support Playbook

When a platform connection fails:

1. Check environment variables in Vercel.
2. Check redirect URI exactly matches the platform app settings.
3. Check user has ad account access.
4. Check app permissions are approved or available in dev mode.
5. Check integration status and sync error fields in the database.
6. Ask the user to reconnect if token refresh or scope changed.

When dashboard data is missing:

1. Confirm an integration exists.
2. Confirm `hasAdsAccess` is true.
3. Confirm a primary `AdAccount` exists.
4. Run manual sync.
5. Check campaign count in the database.
6. Check logs for API permission or customer/account mismatch errors.

