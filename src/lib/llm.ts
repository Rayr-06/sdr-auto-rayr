// SDR Autopilot — Multi-provider LLM Integration
// Supports: Groq (free), Anthropic Claude, OpenAI-compatible APIs

export type LLMProvider = 'groq' | 'anthropic' | 'openai';

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LLMProvider;
}

function getProviderConfig(): ProviderConfig | null {
  // Priority: GROQ → ANTHROPIC → OPENAI
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      provider: 'groq',
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      provider: 'anthropic',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provider: 'openai',
    };
  }
  return null;
}

async function callAnthropicAPI(config: ProviderConfig, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) { console.error('[SDR] Anthropic error:', response.status, await response.text()); return null; }
  const data = await response.json();
  return data?.content?.[0]?.text ?? null;
}

async function callOpenAICompatibleAPI(config: ProviderConfig, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!response.ok) { console.error(`[SDR] ${config.provider} error:`, response.status, await response.text()); return null; }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const config = getProviderConfig();
  if (!config) {
    console.warn('[SDR] No LLM API key found — using demo data. Set GROQ_API_KEY (free) or ANTHROPIC_API_KEY in .env');
    return null;
  }
  try {
    console.log(`[SDR] Using provider: ${config.provider} / ${config.model}`);
    if (config.provider === 'anthropic') return await callAnthropicAPI(config, systemPrompt, userPrompt);
    return await callOpenAICompatibleAPI(config, systemPrompt, userPrompt);
  } catch (error) {
    console.error('[SDR] LLM call failed:', error);
    return null;
  }
}

export function getActiveLLMInfo(): { provider: string; model: string; configured: boolean } {
  const config = getProviderConfig();
  if (!config) return { provider: 'demo', model: 'demo-data', configured: false };
  return { provider: config.provider, model: config.model, configured: true };
}

export function parseJSONResponse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonStr.trim());
  } catch {
    // Try to extract JSON object/array from mixed text
    const objMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try { return JSON.parse(objMatch[1]); } catch { /* fall through */ }
    }
    return fallback;
  }
}

// ─── Demo / Fallback Data ─────────────────────────────────

export const DEMO_COMPANIES = [
  { name: 'TechCorp', domain: 'techcorp.io', size: '200-500', industry: 'SaaS', revenue: '$15M' },
  { name: 'DataFlow Inc', domain: 'dataflow.com', size: '100-200', industry: 'Data Analytics', revenue: '$8M' },
  { name: 'CloudScale', domain: 'cloudscale.dev', size: '500-1000', industry: 'Cloud Infrastructure', revenue: '$45M' },
  { name: 'InnovateLabs', domain: 'innovatelabs.co', size: '50-100', industry: 'AI/ML', revenue: '$5M' },
  { name: 'SalesPilot AI', domain: 'salespilot.ai', size: '1000-5000', industry: 'Sales Tech', revenue: '$120M' },
  { name: 'PipelineGenius', domain: 'pipelinegenius.io', size: '200-500', industry: 'Revenue Intelligence', revenue: '$22M' },
  { name: 'GrowthEngine', domain: 'growthengine.ai', size: '100-200', industry: 'Growth Marketing', revenue: '$12M' },
  { name: 'MarketPulse', domain: 'marketpulse.io', size: '50-100', industry: 'Market Intelligence', revenue: '$6M' },
];

export const DEMO_CONTACTS = [
  { full_name: 'Sarah Chen', email: 'sarah.chen@{domain}', title: 'VP of Sales', linkedin: 'linkedin.com/in/sarahchen' },
  { full_name: 'Michael Rodriguez', email: 'mrodriguez@{domain}', title: 'CRO', linkedin: 'linkedin.com/in/mrodriguez' },
  { full_name: 'Emily Watson', email: 'ewatson@{domain}', title: 'Head of Growth', linkedin: 'linkedin.com/in/emilywatson' },
  { full_name: 'James Park', email: 'jpark@{domain}', title: 'Director of Sales', linkedin: 'linkedin.com/in/jamespark' },
  { full_name: 'Lisa Thompson', email: 'lthompson@{domain}', title: 'VP of Revenue', linkedin: 'linkedin.com/in/lisathompson' },
  { full_name: 'David Kim', email: 'dkim@{domain}', title: 'Chief Revenue Officer', linkedin: 'linkedin.com/in/davidkim' },
  { full_name: 'Amanda Foster', email: 'afoster@{domain}', title: 'Head of Sales Operations', linkedin: 'linkedin.com/in/amandafoster' },
  { full_name: 'Robert Lee', email: 'rlee@{domain}', title: 'SVP Sales', linkedin: 'linkedin.com/in/robertlee' },
];

export const DEMO_SIGNAL_TYPES = [
  { signalType: 'funding', source: 'Crunchbase', weight: 0.9, humanSummary: 'Recently raised Series B funding of $25M' },
  { signalType: 'hiring', source: 'LinkedIn Jobs', weight: 0.8, humanSummary: 'Actively hiring 5+ SDRs and Account Executives' },
  { signalType: 'tech_change', source: 'BuiltWith', weight: 0.7, humanSummary: 'Recently migrated to Salesforce CRM' },
  { signalType: 'news', source: 'TechCrunch', weight: 0.75, humanSummary: 'Announced expansion into European markets' },
  { signalType: 'product_launch', source: 'Product Hunt', weight: 0.65, humanSummary: 'Launched new AI-powered analytics feature' },
  { signalType: 'leadership', source: 'LinkedIn', weight: 0.6, humanSummary: 'New CRO joined from a competitor last month' },
  { signalType: 'partnership', source: 'Press Release', weight: 0.55, humanSummary: 'Strategic partnership with major enterprise client' },
  { signalType: 'expansion', source: 'SEC Filing', weight: 0.85, humanSummary: 'Opened new office in San Francisco, doubling headcount' },
];

export function generateDemoEmail(
  prospectContact: Record<string, string>,
  prospectCompany: Record<string, string>,
  signals: Array<{ humanSummary: string }>
): { subjectLines: string[]; body: string; spamScore: number; readabilityGrade: number; wordCount: number } {
  const firstName = (prospectContact.full_name || 'there').split(' ')[0];
  const companyName = prospectCompany.name || 'your company';
  const signalText = signals.length > 0 ? signals[0].humanSummary : 'your recent growth';
  const subjectLines = [
    `${firstName}, ${companyName}'s growth caught our attention`,
    `Quick question about ${companyName}'s sales stack`,
    `How ${companyName} can close 40% more pipeline`,
  ];
  const body = `Hi ${firstName},

I noticed ${signalText} at ${companyName} — congrats on the momentum!

We help ${prospectCompany.industry || 'B2B'} companies like yours cut prospecting time by 80% and reach 10x more qualified buyers using AI. Teams using us typically book 3x more meetings in the first 30 days.

Would a 15-min call this week make sense to see if it's a fit for ${companyName}?

Best,
Alex Morgan
Head of Growth, OutReachPro`;
  return { subjectLines, body, spamScore: 1.2, readabilityGrade: 7.5, wordCount: body.split(/\s+/).length };
}

// ─── Type Definitions ──────────────────────────────────────

export interface ICPConfig {
  industries?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  targetTitles?: string[];
  seniority?: string[];
  geographies?: string[];
  techSignals?: string[];
  painKeywords?: string[];
  painPoints?: string[];
  buyingSignals?: string[];
  competitors?: string[];
  [key: string]: unknown;
}

export interface ProspectProfile {
  full_name: string;
  email: string;
  title: string;
  linkedin: string;
  icpScore: number;
  keyPainPoint: string;
  company: { name: string; domain: string; size: string; industry: string; revenue: string };
}

export interface SignalData {
  signalType: string;
  source: string;
  weight: number;
  humanSummary: string;
  rawData?: Record<string, unknown>;
}

export interface ColdEmailResult {
  subjectLines: string[];
  body: string;
  spamScore: number;
  readabilityGrade: number;
  wordCount: number;
  personalisationTokens: string[];
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  intent: string;
  suggestedAction: string;
  keyPhrases: string[];
}

// ─── AI Functions ──────────────────────────────────────────

export async function generateProspectProfiles(icpConfig: ICPConfig): Promise<ProspectProfile[]> {
  const { industries = ['SaaS'], companySizeMin = 50, companySizeMax = 1000, targetTitles = ['VP Sales'], seniority = ['VP'], geographies = ['US'], techSignals = ['Salesforce'], painKeywords = ['pipeline'] } = icpConfig;
  const num = 5 + Math.floor(Math.random() * 4);
  const resp = await callLLM(
    'You are a B2B sales research analyst. Always respond with valid JSON only — no markdown, no explanation.',
    `Generate ${num} realistic B2B prospect profiles for this ICP:
Industries: ${industries.join(', ')} | Size: ${companySizeMin}-${companySizeMax} employees | Titles: ${targetTitles.join(', ')} | Seniority: ${seniority.join(', ')} | Geos: ${geographies.join(', ')} | Tech: ${techSignals.join(', ')} | Pain: ${painKeywords.join(', ')}

Return JSON array. Each item: full_name, email (firstname.lastname@domain), title, linkedin (linkedin.com/in/name), icpScore (50-98), keyPainPoint, company: {name, domain, size, industry, revenue}. Use fictional but realistic names.`
  );
  const profiles = parseJSONResponse<ProspectProfile[] | null>(resp, null);
  if (Array.isArray(profiles) && profiles.length > 0) {
    return profiles.filter(p => p.full_name && p.company?.name).map(p => ({
      full_name: String(p.full_name),
      email: String(p.email || `${p.full_name.toLowerCase().replace(/\s+/g, '.')}@${p.company?.domain || 'example.com'}`),
      title: String(p.title || 'Director'),
      linkedin: String(p.linkedin || `linkedin.com/in/${p.full_name.toLowerCase().replace(/\s+/g, '')}`),
      icpScore: typeof p.icpScore === 'number' ? p.icpScore : 65 + Math.random() * 30,
      keyPainPoint: String(p.keyPainPoint || 'Scaling outbound efficiently'),
      company: { name: String(p.company?.name || 'Corp'), domain: String(p.company?.domain || 'corp.com'), size: String(p.company?.size || `${companySizeMin}-${companySizeMax}`), industry: String(p.company?.industry || industries[0]), revenue: String(p.company?.revenue || '$10M') },
    }));
  }
  console.warn('[SDR] Using demo prospects');
  return Array.from({ length: num }, (_, i) => {
    const co = DEMO_COMPANIES[i % DEMO_COMPANIES.length];
    const ct = DEMO_CONTACTS[i % DEMO_CONTACTS.length];
    return { full_name: ct.full_name, email: ct.email.replace('{domain}', co.domain), title: ct.title, linkedin: ct.linkedin, icpScore: Math.round((55 + Math.random() * 40) * 10) / 10, keyPainPoint: painKeywords[i % painKeywords.length] || 'Scaling outbound', company: co };
  });
}

export async function analyzeSignals(prospect: { full_name: string; title: string }, company: { name: string; domain: string; size: string; industry: string; revenue: string }): Promise<SignalData[]> {
  const num = 2 + Math.floor(Math.random() * 3);
  const resp = await callLLM(
    'You are a B2B intent signal analyst. Always respond with valid JSON only — no markdown, no explanation.',
    `Generate ${num} buying signals for:
Contact: ${prospect.full_name}, ${prospect.title} | Company: ${company.name}, ${company.industry}, ${company.size} employees, ${company.revenue}

Return JSON array. Each: signalType (funding/hiring/tech_change/news/product_launch/leadership/partnership/expansion), source, weight (0.4-1.0), humanSummary (1 sentence naming the company), rawData (2-3 fields). Vary types.`
  );
  const signals = parseJSONResponse<SignalData[] | null>(resp, null);
  if (Array.isArray(signals) && signals.length > 0) {
    return signals.filter(s => s.signalType && s.humanSummary).map(s => ({
      signalType: String(s.signalType), source: String(s.source || 'Web'), weight: typeof s.weight === 'number' ? Math.round(s.weight * 100) / 100 : 0.5, humanSummary: String(s.humanSummary), rawData: typeof s.rawData === 'object' ? s.rawData as Record<string, unknown> : {},
    }));
  }
  console.warn('[SDR] Using demo signals');
  return DEMO_SIGNAL_TYPES.slice(0, num).map(s => ({ ...s, humanSummary: s.humanSummary.replace('Recently', `${company.name} recently`) }));
}

export async function generateColdEmail(prospect: { full_name: string; title: string; email: string }, company: { name: string; domain: string; size: string; industry: string; revenue: string }, signals: Array<{ signalType: string; humanSummary: string; weight: number }>, icpConfig: ICPConfig = {}): Promise<ColdEmailResult> {
  const firstName = prospect.full_name.split(' ')[0] || 'there';
  const resp = await callLLM(
    'You are an expert B2B cold email copywriter. Write concise, personalised outreach. Avoid spam words. Always respond with valid JSON only — no markdown, no explanation.',
    `Write a cold email for:
Contact: ${prospect.full_name}, ${prospect.title} at ${company.name} | Industry: ${company.industry} | Size: ${company.size} | Revenue: ${company.revenue}
Pain keywords: ${icpConfig.painKeywords?.join(', ') || 'pipeline, outbound'}
Signals: ${signals.map((s, i) => `${i + 1}. [${s.signalType}] ${s.humanSummary}`).join(' | ')}

Return JSON: subjectLines (3, under 50 chars, no ALL-CAPS or spam), body (120-180 words, open "Hi ${firstName},", reference 1 signal, mention their ${prospect.title} role, include 1 metric, end with soft CTA question, sign as "Alex Morgan\nHead of Growth, OutReachPro"), personalisationTokens (array), spamScore (0-10), readabilityGrade (6-8 target).`
  );
  const data = parseJSONResponse<Record<string, unknown> | null>(resp, null);
  const demo = generateDemoEmail(prospect as Record<string, string>, company as Record<string, string>, signals);
  if (data && Array.isArray(data.subjectLines) && typeof data.body === 'string' && data.body.length > 50) {
    const body = String(data.body);
    return { subjectLines: (data.subjectLines as string[]).slice(0, 3).map(String), body, spamScore: typeof data.spamScore === 'number' ? data.spamScore : demo.spamScore, readabilityGrade: typeof data.readabilityGrade === 'number' ? data.readabilityGrade : demo.readabilityGrade, wordCount: body.split(/\s+/).length, personalisationTokens: Array.isArray(data.personalisationTokens) ? (data.personalisationTokens as string[]).map(String) : ['{{first_name}}', '{{company_name}}'] };
  }
  console.warn('[SDR] Using demo email');
  return { ...demo, personalisationTokens: ['{{first_name}}', '{{company_name}}'] };
}

export async function analyzeSentiment(replyText: string): Promise<SentimentResult> {
  if (!replyText?.trim()) return { sentiment: 'neutral', confidence: 0, intent: 'no_content', suggestedAction: 'no_reply', keyPhrases: [] };
  const resp = await callLLM(
    'You are a B2B sales communication analyst. Always respond with valid JSON only — no markdown, no explanation.',
    `Analyze: "${replyText}"
Return JSON: sentiment (positive/neutral/negative), confidence (0-1), intent (meeting_request/info_request/objection/rejection/interested/not_interested), suggestedAction (schedule_meeting/send_info/handle_objection/follow_up_later/remove_from_list), keyPhrases (2-5 phrases).`
  );
  const data = parseJSONResponse<SentimentResult | null>(resp, null);
  if (data?.sentiment) return { sentiment: ['positive','neutral','negative'].includes(data.sentiment) ? data.sentiment : 'neutral', confidence: typeof data.confidence === 'number' ? data.confidence : 0.5, intent: data.intent || 'interested', suggestedAction: data.suggestedAction || 'follow_up_later', keyPhrases: Array.isArray(data.keyPhrases) ? data.keyPhrases.map(String) : [] };
  const lower = replyText.toLowerCase();
  const pos = ['interested','yes','sure',"let's",'schedule','meeting','sounds good'].some(w => lower.includes(w));
  const neg = ['not interested','remove','unsubscribe','stop emailing'].some(w => lower.includes(w));
  if (pos && !neg) return { sentiment: 'positive', confidence: 0.7, intent: 'meeting_request', suggestedAction: 'schedule_meeting', keyPhrases: [] };
  if (neg) return { sentiment: 'negative', confidence: 0.7, intent: 'not_interested', suggestedAction: 'remove_from_list', keyPhrases: [] };
  return { sentiment: 'neutral', confidence: 0.4, intent: 'info_request', suggestedAction: 'follow_up_later', keyPhrases: [] };
}
