export type CampaignStatus = 'active' | 'paused' | 'completed' | 'scheduled';

export interface Campaign {
  id: string;
  workspace_id: string;
  external_id?: string;
  name: string;
  platform: 'meta' | 'google' | 'tiktok';
  status: CampaignStatus;
  daily_budget?: number;
  currency: string;
  created_at: string;
  updated_at: string;
}
