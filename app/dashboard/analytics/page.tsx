"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/dashboard-v2/shell";
import { PageHeader, SectionCard, EmptyState } from "@/components/growzzy/primitives";
import { KpiCard } from "@/components/growzzy/kpi-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, LineChart as LineChartIcon, Loader2, DollarSign, MousePointer, Target, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Overview = {
  kpis: {
    totalSpend: number;
    totalRevenue: number;
    totalClicks: number;
    totalImpressions: number;
    totalConversions: number;
    ctr: number;
    roas: number;
    activeCampaigns: number;
    totalCampaigns: number;
    newLeads: number;
    connectedPlatforms: number;
  };
  chartData: { date: string; spend: number; revenue: number; clicks: number; conversions: number; impressions: number }[];
  topCampaigns: {
    id: string;
    name: string;
    platform: string;
    status: string;
    spend: number;
    revenue: number;
    roas: number;
  }[];
  bottomCampaigns: {
    id: string;
    name: string;
    platform: string;
    status: string;
    spend: number;
    revenue: number;
    roas: number;
  }[];
  platformBreakdown: {
    name: string;
    spend: number;
    revenue: number;
    roas: number;
    campaigns: number;
    percentOfSpend: number;
  }[];
  platforms: { name: string; accountName: string | null; lastSynced: string | null; adAccountId: string | null }[];
  period: { days: number; from: string; to: string };
};

function money(n: number) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AnalyticsPage() {
  const [metric, setMetric] = useState("spend");
  const [range, setRange] = useState("30d");
  const [platform, setPlatform] = useState("all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    setLoading(true);
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    fetch(`/api/analytics/overview?days=${days}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false));
  }, [range]);

  const hasData = (data?.kpis?.connectedPlatforms ?? 0) > 0 && (data?.chartData?.length ?? 0) > 0;

  return (
    <Shell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Analytics"
          subtitle="Deep dive into every campaign, keyword and audience."
          actions={
            <Button variant="outline" className="gap-1.5 cursor-pointer">
              <Sparkles className="h-4 w-4" />
              AI insights
            </Button>
          }
        />

        <SectionCard className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {(data?.topCampaigns ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <KpiCard
            label="Spend"
            value={data?.kpis ? money(data.kpis.totalSpend) : "$0"}
            caption={hasData ? undefined : "No data yet"}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            label="Revenue"
            value={data?.kpis ? money(data.kpis.totalRevenue || 0) : "$0"}
            caption={hasData ? undefined : "No data yet"}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            label="Conversions"
            value={data?.kpis ? data.kpis.totalConversions.toLocaleString() : "0"}
            caption={hasData && data ? `${data.kpis.newLeads} leads` : "No data yet"}
            icon={<Target className="h-4 w-4" />}
          />
          <KpiCard
            label="Clicks"
            value={data?.kpis ? data.kpis.totalClicks.toLocaleString() : "0"}
            caption={hasData && data ? `${data.kpis.totalImpressions.toLocaleString()} imp` : "No data yet"}
            icon={<MousePointer className="h-4 w-4" />}
          />
          <KpiCard
            label="CTR"
            value={data?.kpis ? `${(data.kpis.ctr * 100).toFixed(2)}%` : "0%"}
            caption={hasData ? undefined : "No data yet"}
            icon={<MousePointer className="h-4 w-4" />}
          />
          <KpiCard
            label="ROAS"
            value={data?.kpis?.roas ? `${data.kpis.roas.toFixed(2)}x` : "—"}
            caption={hasData && data ? `${data.kpis.activeCampaigns} active` : "No data yet"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <SectionCard
            className="lg:col-span-3"
            title="Performance over time"
            action={
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="ctr">CTR</SelectItem>
                  <SelectItem value="conversions">Conversions</SelectItem>
                  <SelectItem value="roas">ROAS</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            {loading ? (
              <div className="h-64 grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : hasData ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.chartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9EBEF" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#5A6577" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#5A6577" }}
                      tickFormatter={(v) => (metric === "spend" || metric === "revenue" ? `$${v}` : v)}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: "1px solid #E9EBEF" }}
                      formatter={(v: any) => (metric === "spend" || metric === "revenue" ? [`$${v}`, metric] : [v, metric])}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke="#1F57F5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 grid place-items-center">
                <EmptyState
                  icon={<LineChartIcon className="h-6 w-6" />}
                  title="No data to chart"
                  description="Connect Google Ads or Meta Ads and launch a campaign to see performance here."
                />
              </div>
            )}

            <div className="mt-6 border-t border-border pt-4">
              <Tabs defaultValue="campaign">
                <TabsList>
                  <TabsTrigger value="campaign">By campaign</TabsTrigger>
                  <TabsTrigger value="keyword">By keyword</TabsTrigger>
                  <TabsTrigger value="device">By device / geo</TabsTrigger>
                  <TabsTrigger value="platform">By platform</TabsTrigger>
                </TabsList>
                <TabsContent value="campaign">
                  {(data?.topCampaigns ?? []).length > 0 ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-2 pr-2 font-medium">Campaign</th>
                            <th className="py-2 px-2 font-medium">Platform</th>
                            <th className="py-2 px-2 font-medium text-right">Spend</th>
                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                            <th className="py-2 pl-2 font-medium text-right">ROAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.topCampaigns.map((c) => (
                            <tr key={c.id} className="border-b border-border/50 last:border-0">
                              <td className="py-2 pr-2 font-medium truncate max-w-[200px]">{c.name}</td>
                              <td className="py-2 px-2 text-muted-foreground">{c.platform}</td>
                              <td className="py-2 px-2 text-right">{money(c.spend)}</td>
                              <td className="py-2 px-2 text-right">{money(c.revenue)}</td>
                              <td className="py-2 pl-2 text-right font-semibold">{c.roas.toFixed(2)}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No campaigns yet" className="py-6" />
                  )}
                </TabsContent>
                <TabsContent value="keyword">
                  <EmptyState
                    title="No keyword data yet"
                    description="Search-term breakdowns from Google Ads appear here once you have impression-share data."
                    className="py-6"
                  />
                </TabsContent>
                <TabsContent value="device">
                  <EmptyState
                    title="No device / geo data yet"
                    description="Breakdowns by device (mobile/desktop) and geography arrive after your first sync."
                    className="py-6"
                  />
                </TabsContent>
                <TabsContent value="platform">
                  {(data?.platformBreakdown ?? []).length > 0 ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-2 pr-2 font-medium">Platform</th>
                            <th className="py-2 px-2 font-medium text-right">Spend</th>
                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                            <th className="py-2 px-2 font-medium text-right">% of spend</th>
                            <th className="py-2 pl-2 font-medium text-right">ROAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.platformBreakdown.map((p) => (
                            <tr key={p.name} className="border-b border-border/50 last:border-0">
                              <td className="py-2 pr-2 font-medium">{p.name}</td>
                              <td className="py-2 px-2 text-right">{money(p.spend)}</td>
                              <td className="py-2 px-2 text-right">{money(p.revenue)}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{p.percentOfSpend}%</td>
                              <td className="py-2 pl-2 text-right font-semibold">{p.roas.toFixed(2)}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No platform data yet" className="py-6" />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </SectionCard>

          <SectionCard title="AI insights">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Insights appear here"
              description="Once your campaigns have data, Growzzy explains what's working and what to change — with the numbers to back it up."
            />
          </SectionCard>
        </div>
      </div>
    </Shell>
  );
}
