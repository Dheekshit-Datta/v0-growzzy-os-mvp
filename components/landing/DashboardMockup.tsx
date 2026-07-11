import { GoogleLogo, MetaLogo } from "./PlatformLogos";
import { Sparkles, TrendingUp, Search, Bell } from "lucide-react";

type Row = {
  campaign: string;
  platform: "meta" | "google";
  spend: string;
  roas: string;
  status: "Active" | "Optimizing" | "Paused";
  suggestion: string;
  highlight?: boolean;
};

const rows: Row[] = [
  { campaign: "Spring Launch — Prospecting", platform: "meta", spend: "$4,820", roas: "3.8x", status: "Active", suggestion: "Hold" },
  { campaign: "Brand Search — US", platform: "google", spend: "$2,140", roas: "6.2x", status: "Active", suggestion: "↑ Budget +20%" },
  { campaign: "Shopping Retargeting", platform: "meta", spend: "$1,910", roas: "4.4x", status: "Optimizing", suggestion: "Reallocate", highlight: true },
  { campaign: "Retargeting — 30d", platform: "meta", spend: "$3,260", roas: "5.1x", status: "Active", suggestion: "↑ Budget +18%" },
  { campaign: "PMax — Catalog", platform: "google", spend: "$5,430", roas: "4.6x", status: "Active", suggestion: "New creative" },
  { campaign: "Competitor Search", platform: "google", spend: "$980", roas: "2.9x", status: "Paused", suggestion: "Refresh copy" },
];

function PlatformIcon({ p }: { p: Row["platform"] }) {
  if (p === "meta") return <MetaLogo className="h-4 w-4 text-meta" />;
  if (p === "google") return <GoogleLogo className="h-4 w-4" />;
  return <GoogleLogo className="h-4 w-4" />;
}

export function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        className="overflow-hidden rounded-2xl border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                <path d="M4 14c4-8 12-8 16 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="12" cy="16" r="2" fill="white" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-medium text-ink">Workspace</p>
              <p className="text-[11px] text-ink-soft">Acme Inc · All campaigns</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-surface-soft px-3 py-1.5 text-xs text-ink-soft sm:flex">
            <Search className="h-3.5 w-3.5" />
            <span>Search campaigns, platforms, AI suggestions…</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] text-ink sm:inline-flex">
              <Sparkles className="h-3 w-3" /> AI Copilot
            </span>
            <Bell className="h-4 w-4 text-ink-soft" />
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-6 border-b border-border/70 px-5 text-xs">
          {["Campaigns", "Audiences", "Creatives", "Reports", "AI Optimizer"].map((t, i) => (
            <button
              key={t}
              className={`-mb-px border-b-2 py-3 ${
                i === 0
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-soft text-[11px] uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-5 py-2.5 font-medium">Campaign</th>
                <th className="px-3 py-2.5 font-medium">Platform</th>
                <th className="px-3 py-2.5 font-medium">Spend</th>
                <th className="px-3 py-2.5 font-medium">ROAS</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-t border-border/60 ${
                    r.highlight ? "bg-brand-soft/10" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 text-ink">{r.campaign}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      <PlatformIcon p={r.platform} />
                      <span className="capitalize">{r.platform}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink">{r.spend}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-ink">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                      {r.roas}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
                        r.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : r.status === "Optimizing"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-muted text-ink-soft"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] text-ink">
                      <Sparkles className="h-3 w-3" /> {r.suggestion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating AI chip */}
      <div
        className="absolute -bottom-6 left-6 hidden max-w-xs items-start gap-3 rounded-2xl border border-border bg-surface p-4 md:flex"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-ink">AI Copilot</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
            Shift <span className="text-ink">$400</span> from low-ROAS search to Meta to capture{" "}
            <span className="text-ink">+18% ROAS</span> this week.
          </p>
        </div>
      </div>
    </div>
  );
}
