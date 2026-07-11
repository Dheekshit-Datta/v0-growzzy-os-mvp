export type AudienceType = 'lookalike' | 'interest' | 'behavior' | 'retargeting' | 'zero_party';

export interface Audience {
  id: string;
  workspace_id: string;
  name: string;
  type: AudienceType;
  definition: Record<string, any>; // JSON definition of audience targeting
  size_estimate?: number;
  created_at: string;
  updated_at: string;
}
