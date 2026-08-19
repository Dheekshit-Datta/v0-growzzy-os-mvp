export type CampaignStatus = "live" | "paused" | "learning" | "rejected" | "draft";
export type Platform = "google" | "meta";

export interface Workspace {
  id: string;
  businessName: string;
  website: string;
  primaryGoal: "sales" | "leads" | "app_installs" | "traffic";
  currency: string;
  timezone: string;
  dailyBudgetCeiling: number;
  productDescription: string;
  logoUrl?: string;
  industry?: string;
  tone?: string;
  defaultLandingPage?: string;
  googleConnected: boolean;
  metaConnected: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  spend: number;
  clicks: number;
  conversions: number;
  cpa: number;
  roas: number;
  budgetDaily: number;
  projectId?: string;
}

export interface KeywordChip {
  text: string;
  match: "broad" | "phrase" | "exact";
  negative?: boolean;
}

export interface Ad {
  headlines: string[];
  descriptions: string[];
}

export interface AdGroup {
  id: string;
  name: string;
  keywords: KeywordChip[];
  negatives: KeywordChip[];
  ads: Ad[];
}

export interface CampaignPlan {
  id: string;
  name: string;
  score: number;
  objective: string;
  bidding: string;
  biddingRationale: string;
  budgetDaily: number;
  expectedResults?: string;
  landingPage?: string;
  adGroups: AdGroup[];
  policy?: PolicyResult;
}

export interface PolicyFlag {
  phrase: string;
  reason: string;
  suggestion: string;
}
export interface PolicyResult {
  state: "pass" | "warn" | "fail";
  flags: PolicyFlag[];
}

export interface Prompt {
  id: string;
  text: string;
  goal: string;
  createdAt: string;
}
export interface Project {
  id: string;
  name: string;
  campaignCount: number;
  totalSpend: number;
}

export interface DashboardKpi {
  spend: number;
  spendTrend: number;
  conversions: number;
  conversionsTrend: number;
  costPerResult: number;
  costPerResultTrend: number;
  roas: number;
  roasTrend: number;
}
export interface SeriesPoint {
  label: string;
  spend: number;
  results: number;
}
export interface DashboardSummary {
  kpi: DashboardKpi;
  series: SeriesPoint[];
  topCampaigns: Campaign[];
  needsAttention: Insight[];
}

export interface Insight {
  id: string;
  severity: "critical" | "medium" | "low";
  finding: string;
  why: string;
  target?: string;
}

export interface OptimizationAction {
  id: string;
  severity: "critical" | "medium" | "low";
  finding: string;
  explanation: string;
  target: string;
  createdAt: string;
  appliedAt?: string;
  outcome?: string;
  prior?: string;
  next?: string;
}

export interface Creative {
  id: string;
  format: "search" | "display" | "social";
  aspectRatio?: string;
  thumbnailUrl?: string;
  headline?: string;
  description?: string;
  createdAt: string;
  usedInCampaign?: boolean;
  performance?: { clicks: number; ctr: number };
}
