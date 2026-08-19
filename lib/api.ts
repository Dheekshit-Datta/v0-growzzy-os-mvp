// Single typed API client. Every fetch goes through here.
export interface ApiError {
  status: number;
  message: string;
}

const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw {
      status: 0,
      message: "Couldn't reach Growzzy — check your connection and try again.",
    } satisfies ApiError;
  }
  if (!res.ok) {
    let msg = res.statusText || "Something went wrong.";
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {
      /* keep default */
    }
    throw { status: res.status, message: msg } satisfies ApiError;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

import type {
  Campaign,
  CampaignPlan,
  DashboardSummary,
  Insight,
  OptimizationAction,
  PolicyResult,
  Prompt,
  Project,
  Workspace,
  Creative,
} from "./types";

export const endpoints = {
  onboarding: {
    save: (data: Partial<Workspace>) => api.patch<Workspace>("/api/onboarding", data),
  },
  workspace: {
    get: () => api.get<Workspace>("/api/workspace"),
    updateBrand: (data: Partial<Workspace>) => api.patch<Workspace>("/api/workspace/brand", data),
  },
  integrations: {
    googleConnectUrl: () => api.get<{ url: string }>("/api/integrations/google/connect"),
    disconnect: (provider: "google" | "meta") => api.post<void>(`/api/integrations/${provider}/disconnect`),
    sync: () => api.post<void>("/api/integrations/google/sync"),
  },
  campaigns: {
    list: () => api.get<Campaign[]>("/api/campaigns"),
    pause: (id: string) => api.post<void>(`/api/campaigns/${id}/pause`),
    enable: (id: string) => api.post<void>(`/api/campaigns/${id}/enable`),
  },
  ai: {
    build: (prompt: string, extras?: Record<string, unknown>) =>
      api.post<{ campaignPlanId: string }>("/api/ai/campaign-builder", { prompt, ...extras }),
    getPlan: (id: string) => api.get<CampaignPlan>(`/api/ai/campaign-plan/${id}`),
    updatePlan: (id: string, patch: Partial<CampaignPlan>) =>
      api.patch<CampaignPlan>(`/api/ai/campaign-plan/${id}`, patch),
    policyCheck: (id: string) => api.post<PolicyResult>(`/api/ai/policy-check`, { planId: id }),
    launch: (id: string) => api.post<{ googleCampaignId: string }>(`/api/ai/campaign-plan/${id}/launch`),
    insights: (filters: unknown) => api.post<Insight[]>("/api/ai/insights", filters),
  },
  dashboard: {
    summary: (range: string) => api.get<DashboardSummary>(`/api/dashboard?range=${range}`),
  },
  optimization: {
    list: () => api.get<OptimizationAction[]>("/api/optimization-actions"),
    approve: (id: string) => api.post<void>(`/api/optimization-actions/${id}/approve`),
    dismiss: (id: string) => api.post<void>(`/api/optimization-actions/${id}/dismiss`),
    log: () => api.get<OptimizationAction[]>("/api/optimization-actions/log"),
  },
  prompts: {
    list: () => api.get<Prompt[]>("/api/prompts"),
    delete: (id: string) => api.delete<void>(`/api/prompts/${id}`),
  },
  projects: {
    list: () => api.get<Project[]>("/api/projects"),
    create: (name: string) => api.post<Project>("/api/projects", { name }),
    rename: (id: string, name: string) => api.patch<Project>(`/api/projects/${id}`, { name }),
    remove: (id: string) => api.delete<void>(`/api/projects/${id}`),
  },
  studio: {
    generate: (data: unknown) => api.post<Creative[]>("/api/studio/generate", data),
    library: () => api.get<Creative[]>("/api/studio/library"),
  },
};
