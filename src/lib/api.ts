// SDR Autopilot API client

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Types
export interface ICP {
  id: string;
  name: string;
  version: number;
  config: Record<string, unknown>;
  active: boolean;
  prospectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Prospect {
  id: string;
  icpId: string;
  contact: { full_name: string; email: string; title: string; linkedin?: string };
  company: { name: string; domain: string; size: string; industry: string; revenue?: string };
  icpScore: number;
  intentScore: number;
  status: 'hot' | 'warm' | 'cold';
  enrichedAt: string | null;
  signalCount: number;
  draftCount: number;
  icpName: string;
  createdAt: string;
}

export interface Signal {
  id: string;
  prospectId: string;
  signalType: string;
  source: string;
  weight: number;
  humanSummary: string;
  rawData: Record<string, unknown>;
  detectedAt: string;
  expiresAt: string | null;
  prospect: {
    id: string;
    contact: { full_name: string; email: string; title: string };
    company: { name: string; domain: string; industry: string };
    status: string;
  };
}

export interface DraftEmail {
  id: string;
  prospectId: string;
  icpId: string | null;
  subjectLines: string[];
  body: string;
  editedSubject: string | null;
  editedBody: string | null;
  selectedSubject: number | null;
  personalisationTokens: string[];
  generationMetadata: Record<string, unknown>;
  spamScore: number;
  readabilityGrade: number;
  wordCount: number;
  status: 'pending' | 'approved' | 'skipped' | 'sent';
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  prospect: {
    id: string;
    contact: { full_name: string; email: string; title: string };
    company: { name: string; domain: string; industry: string; size: string };
    icpScore: number;
    intentScore: number;
    status: string;
    topSignals: Array<{ signalType: string; humanSummary: string; weight: number }>;
  };
}

export interface SentEmail {
  id: string;
  draftId: string | null;
  prospectId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  sendProvider: string;
  trackingId: string;
  sentAt: string;
  openedAt: string | null;
  openCount: number;
  repliedAt: string | null;
  replyText: string | null;
  replySentiment: string | null;
  bounced: boolean;
  createdAt: string;
  prospect: {
    id: string;
    contact: { full_name: string; email: string; title: string };
    company: { name: string; domain: string; industry: string };
    status: string;
  };
  draft: { id: string; subjectLines: string[] } | null;
}

export interface PipelineStats {
  icps: number;
  prospects: number;
  signals: number;
  drafts: number;
  sentEmails: number;
}

export interface ProspectStats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
}

export interface EmailStats {
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
}

// API functions
export const api = {
  // Health
  health: () => request<{ status: string; counts: PipelineStats }>('/health'),

  // Stage 1: Research
  runResearch: (data: {
    industries?: string[];
    companySizeMin?: number;
    companySizeMax?: number;
    targetTitles?: string[];
    seniority?: string[];
    geographies?: string[];
    techSignals?: string[];
    painKeywords?: string[];
  }) =>
    request<{ icp: ICP; prospectIds: string[]; prospectCount: number }>('/stage1/research', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getICPs: () => request<{ icps: ICP[] }>('/stage1/icps'),

  // Stage 2: Enrich
  enrichProspects: (data: { icpId: string; companyDomains?: string[] }) =>
    request<{ enriched: number; results: Array<{ prospectId: string; domain: string; score: number; status: string }> }>('/stage2/enrich', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProspects: (params?: { icpId?: string; status?: string; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.icpId) searchParams.set('icpId', params.icpId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.perPage) searchParams.set('perPage', String(params.perPage));
    const qs = searchParams.toString();
    return request<{ prospects: Prospect[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }>(`/stage2/prospects${qs ? `?${qs}` : ''}`);
  },

  getProspectStats: (icpId?: string) => {
    const qs = icpId ? `?icpId=${icpId}` : '';
    return request<ProspectStats>(`/stage2/stats${qs}`);
  },

  // Stage 3: Signals
  collectSignals: (prospectIds?: string[]) =>
    request<{ prospectsProcessed: number; totalSignals: number; results: Array<{ prospectId: string; signalsCreated: number }> }>('/stage3/collect', {
      method: 'POST',
      body: JSON.stringify({ prospectIds }),
    }),

  getSignals: (params?: { page?: number; perPage?: number; signalType?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.perPage) searchParams.set('perPage', String(params.perPage));
    if (params?.signalType) searchParams.set('signalType', params.signalType);
    const qs = searchParams.toString();
    return request<{ signals: Signal[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }>(`/stage3/signals${qs ? `?${qs}` : ''}`);
  },

  // Stage 4: Generate
  generateEmail: (prospectId: string, icpId?: string) =>
    request<{ draft: DraftEmail }>('/stage4/generate', {
      method: 'POST',
      body: JSON.stringify({ prospectId, icpId }),
    }),

  generateBatch: (prospectIds: string[], icpId?: string) =>
    request<{ total: number; created: number; alreadyExisted: number; errors: number }>('/stage4/generate-batch', {
      method: 'POST',
      body: JSON.stringify({ prospectIds, icpId }),
    }),

  // Stage 5: Approve & Send
  getApprovalQueue: (params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.perPage) searchParams.set('perPage', String(params.perPage));
    const qs = searchParams.toString();
    return request<{ drafts: DraftEmail[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }>(`/stage5/queue${qs ? `?${qs}` : ''}`);
  },

  approveDraft: (id: string, action: 'approve' | 'edit' | 'skip', data?: { selectedSubject?: number; editedSubject?: string; editedBody?: string }) =>
    request<{ draft: DraftEmail; action: string }>(`/stage5/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, ...data }),
    }),

  sendAll: () =>
    request<{ sent: number; errors: number }>('/stage5/send-all', { method: 'POST' }),

  getSentEmails: (params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.perPage) searchParams.set('perPage', String(params.perPage));
    const qs = searchParams.toString();
    return request<{ emails: SentEmail[]; stats: EmailStats; pagination: { page: number; perPage: number; total: number; totalPages: number } }>(`/stage5/sent${qs ? `?${qs}` : ''}`);
  },

  // Pipeline
  runPipeline: (data: {
    industries?: string[];
    companySizeMin?: number;
    companySizeMax?: number;
    targetTitles?: string[];
    seniority?: string[];
    geographies?: string[];
    techSignals?: string[];
    painKeywords?: string[];
  }) =>
    request<{
      success: boolean;
      pipeline: {
        stage1: { icpId: string; icpName: string };
        stage2: { prospectsEnriched: number; prospectIds: string[] };
        stage3: { signalsCollected: number };
        stage4: { draftsGenerated: number };
        stage5: { emailsSent: number };
      };
    }>('/pipeline/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin
  resetAll: () =>
    request<{ success: boolean; message: string }>('/admin/reset', { method: 'DELETE' }),
};
