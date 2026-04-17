'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Search, Users, Activity, Mail, Send, BarChart3, Rocket, ChevronRight,
  Check, SkipForward, Edit3, RefreshCw, Trash2, Zap, Target, Eye,
  MessageSquare, AlertTriangle, Building2, Globe, Sparkles, ArrowRight,
  Loader2, CheckCircle2, Circle, TrendingUp, Clock, Filter,
  Copy, ExternalLink, Info, AlertCircle, Wifi, WifiOff, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ICP, Prospect, Signal, DraftEmail, SentEmail, PipelineStats, ProspectStats, EmailStats } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, LineChart, Line, Area, AreaChart } from 'recharts';

// ── Types ──────────────────────────────────────────────────────
interface LLMConfig { provider: string; model: string; configured: boolean; }

// ── Helpers ────────────────────────────────────────────────────
const statusColor = (s: string) =>
  ({ hot:'bg-red-100 text-red-700 border-red-200', warm:'bg-amber-100 text-amber-700 border-amber-200',
     cold:'bg-slate-100 text-slate-600 border-slate-200', contacted:'bg-blue-100 text-blue-700 border-blue-200',
     pending:'bg-yellow-100 text-yellow-700 border-yellow-200', approved:'bg-emerald-100 text-emerald-700 border-emerald-200',
     skipped:'bg-slate-100 text-slate-500 border-slate-200', sent:'bg-violet-100 text-violet-700 border-violet-200',
   }[s] || 'bg-gray-100 text-gray-600 border-gray-200');

const signalColor = (t: string) =>
  ({ funding:'bg-emerald-100 text-emerald-700', hiring:'bg-amber-100 text-amber-700',
     tech_change:'bg-purple-100 text-purple-700', news:'bg-sky-100 text-sky-700',
     product_launch:'bg-teal-100 text-teal-700', leadership:'bg-rose-100 text-rose-700',
     partnership:'bg-indigo-100 text-indigo-700', expansion:'bg-green-100 text-green-700',
   }[t] || 'bg-gray-100 text-gray-700');

const PROVIDER = {
  groq:      { label:'Groq (Free)', dot:'bg-orange-400', pill:'bg-orange-50 border-orange-200 text-orange-700' },
  anthropic: { label:'Claude',      dot:'bg-violet-400', pill:'bg-violet-50 border-violet-200 text-violet-700' },
  openai:    { label:'OpenAI',      dot:'bg-emerald-400', pill:'bg-emerald-50 border-emerald-200 text-emerald-700' },
  demo:      { label:'Demo Mode',   dot:'bg-gray-400',   pill:'bg-gray-100 border-gray-200 text-gray-600' },
};

const CHART_COLORS = ['#7c3aed','#f59e0b','#0ea5e9','#10b981','#f43f5e','#8b5cf6'];

const fadeUp: Variants = { hidden:{ opacity:0, y:12 }, show:{ opacity:1, y:0, transition:{ duration:0.25, ease:'easeOut' } } };
const stagger: Variants = { show:{ transition:{ staggerChildren:0.06 } } };

// ── Reusable components ────────────────────────────────────────
function ProviderPill({ config }: { config: LLMConfig | null }) {
  if (!config) return null;
  const p = PROVIDER[config.provider as keyof typeof PROVIDER] || PROVIDER.demo;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-default select-none ${p.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot} ${config.configured ? 'animate-pulse' : ''}`} />
            {p.label}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs leading-relaxed">
          {config.configured
            ? `AI active: ${config.provider} / ${config.model}`
            : 'Demo mode — no API key. Add GROQ_API_KEY to .env for free AI generation.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function KPICard({ label, value, sub, icon, accent='violet', delay=0 }: {
  label:string; value:string|number; sub?:string; icon:React.ReactNode; accent?:string; delay?:number;
}) {
  const map: Record<string,{g:string;i:string}> = {
    violet:{g:'from-violet-50/80 to-white',i:'bg-violet-500'}, emerald:{g:'from-emerald-50/80 to-white',i:'bg-emerald-500'},
    amber:{g:'from-amber-50/80 to-white',i:'bg-amber-500'},    blue:{g:'from-blue-50/80 to-white',i:'bg-blue-500'},
    purple:{g:'from-purple-50/80 to-white',i:'bg-purple-500'}, rose:{g:'from-rose-50/80 to-white',i:'bg-rose-500'},
    sky:{g:'from-sky-50/80 to-white',i:'bg-sky-500'},
  };
  const a = map[accent] || map.violet;
  return (
    <motion.div variants={fadeUp} custom={delay}>
      <Card className={`bg-gradient-to-br ${a.g} border-0 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-200`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
              <p className="text-3xl font-bold tracking-tight count-up leading-none">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
            </div>
            <div className={`${a.i} p-2.5 rounded-xl text-white shadow-sm flex-shrink-0 mt-0.5`}>{icon}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PipelineFlowBar({ stats, onNavigate }: { stats: PipelineStats; onNavigate:(t:string)=>void }) {
  const stages = [
    { id:'stage1', label:'Research', count:stats.icps, icon:Search, color:'bg-emerald-500', ring:'ring-emerald-300' },
    { id:'stage2', label:'Prospects', count:stats.prospects, icon:Users, color:'bg-amber-500', ring:'ring-amber-300' },
    { id:'stage3', label:'Signals', count:stats.signals, icon:Activity, color:'bg-blue-500', ring:'ring-blue-300' },
    { id:'stage4', label:'Drafts', count:stats.drafts, icon:Sparkles, color:'bg-purple-500', ring:'ring-purple-300' },
    { id:'stage5', label:'Sent', count:stats.sentEmails, icon:Send, color:'bg-rose-500', ring:'ring-rose-300' },
  ];
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  return (
    <div className="flex items-end gap-2 sm:gap-3 w-full">
      {stages.map((s, i) => (
        <React.Fragment key={s.id}>
          <button onClick={() => onNavigate(s.id)}
            className="flex flex-col items-center gap-2 flex-1 group transition-opacity hover:opacity-100 opacity-85">
            <span className="text-base sm:text-xl font-bold tabular-nums">{s.count}</span>
            <div className={`${s.color} ${s.count > 0 ? `ring-2 ${s.ring} ring-offset-1` : ''} w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-soft group-hover:shadow-card group-hover:scale-105 transition-all duration-150`}>
              <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
              <div className={`${s.color} h-1 rounded-full transition-all duration-700`}
                style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }} />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{s.label}</span>
          </button>
          {i < stages.length - 1 && (
            <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mb-10 transition-colors flow-pulse ${stages[i].count > 0 && stages[i+1].count > 0 ? 'text-violet-400' : 'text-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: { icon:React.ReactNode; title:string; desc:string; action?:React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-400">{icon}</div>
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ScoreBar({ value, max=100, color='bg-violet-500' }: { value:number; max?:number; color?:string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`${color} h-1.5 rounded-full`} style={{ width:`${Math.round((value/max)*100)}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-7 text-right">{Math.round(value)}</span>
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────
function OverviewTab({ stats, ps, es, llm, onRun, onNav, running }: {
  stats:PipelineStats; ps:ProspectStats; es:EmailStats; llm:LLMConfig|null;
  onRun:()=>void; onNav:(t:string)=>void; running:boolean;
}) {
  const empty = stats.icps === 0;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

      {empty ? (
        <motion.div variants={fadeUp}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-7 sm:p-10 text-white shadow-lift">
            <div className="absolute inset-0 opacity-[0.07]" style={{backgroundImage:'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',backgroundSize:'28px 28px'}} />
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">SDR Autopilot</p>
                  <p className="text-xs opacity-60">by RAYR · Adithya Sharma</p>
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
                Your AI sales pipeline.<br/>
                <span className="opacity-75">Research to reply in 30 min.</span>
              </h2>
              <div className="flex flex-wrap gap-2 mb-6 text-xs">
                {[['< 3 min', 'per prospect'],['100–200', 'prospects/day'],['+60%', 'reply rate']].map(([v,l]) => (
                  <div key={l} className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
                    <span className="font-bold">{v}</span><span className="opacity-75">{l}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={onRun} disabled={running} size="lg"
                  className="bg-white text-violet-700 hover:bg-white/90 font-bold shadow-card px-6">
                  {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Rocket className="w-4 h-4 mr-2"/>}
                  {running ? 'Running pipeline…' : 'Run Full Pipeline'}
                </Button>
                <ProviderPill config={llm} />
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">Pipeline Overview</h2>
            <p className="text-sm text-muted-foreground">Real-time SDR automation</p>
          </div>
          <div className="flex items-center gap-2">
            <ProviderPill config={llm} />
            <Button onClick={onRun} disabled={running} className="bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-soft">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Rocket className="w-4 h-4 mr-2"/>}
              {running ? 'Running…' : 'Run Pipeline'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pipeline flow */}
      <motion.div variants={fadeUp}>
        <Card className="border-0 shadow-soft bg-white/90">
          <CardHeader className="pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              Pipeline Flow — click any stage to navigate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <PipelineFlowBar stats={stats} onNavigate={onNav} />
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI grid */}
      <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="ICPs" value={stats.icps} icon={<Target className="w-5 h-5"/>} accent="violet" />
        <KPICard label="Prospects" value={stats.prospects} icon={<Users className="w-5 h-5"/>} sub={`${ps.hot} hot · ${ps.warm} warm`} accent="amber" />
        <KPICard label="Signals" value={stats.signals} icon={<Activity className="w-5 h-5"/>} accent="blue" />
        <KPICard label="Drafts" value={stats.drafts} icon={<Mail className="w-5 h-5"/>} accent="purple" />
        <KPICard label="Sent" value={stats.sentEmails} icon={<Send className="w-5 h-5"/>} accent="rose" />
        <KPICard label="Open Rate" value={`${es.openRate}%`} icon={<Eye className="w-5 h-5"/>} sub={`${es.replyRate}% reply`} accent="emerald" />
      </motion.div>

      {/* Charts */}
      {stats.sentEmails > 0 && (
        <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-soft">
            <CardHeader className="pb-1 pt-5 px-6"><CardTitle className="text-sm font-semibold">Prospect Mix</CardTitle></CardHeader>
            <CardContent className="px-6 pb-5">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{v:ps.hot},{v:ps.warm},{v:ps.cold}].map((d,i)=>({name:['Hot','Warm','Cold'][i],value:d.v}))}
                      dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4}>
                      {['#ef4444','#f59e0b','#94a3b8'].map((c,i)=><Cell key={i} fill={c}/>)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-5 mt-1">
                {[['#ef4444','Hot',ps.hot],['#f59e0b','Warm',ps.warm],['#94a3b8','Cold',ps.cold]].map(([c,n,v])=>(
                  <div key={String(n)} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:String(c)}}/>
                    {n} <strong className="text-foreground">{v}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardHeader className="pb-1 pt-5 px-6"><CardTitle className="text-sm font-semibold">Email Funnel</CardTitle></CardHeader>
            <CardContent className="px-6 pb-5">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{n:'Sent',v:es.sent},{n:'Opened',v:es.opened},{n:'Replied',v:es.replied},{n:'Bounced',v:es.bounced}]}
                    margin={{top:4,right:4,bottom:0,left:-24}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="n" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <RTooltip />
                    <Bar dataKey="v" radius={[5,5,0,0]}>{CHART_COLORS.map((c,i)=><Cell key={i} fill={c}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick-start cards */}
      {empty && (
        <motion.div variants={fadeUp}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Or start a specific stage</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {id:'stage1',label:'1. Define ICP',desc:'Set target market criteria & generate prospect list',icon:Search,color:'bg-emerald-500'},
              {id:'stage3',label:'3. Collect Signals',desc:'Detect hiring, funding & buying intent signals',icon:Activity,color:'bg-blue-500'},
              {id:'stage4',label:'4. Generate Emails',desc:'AI-crafted, personalised cold outreach at scale',icon:Sparkles,color:'bg-purple-500'},
            ].map(item=>(
              <button key={item.id} onClick={()=>onNav(item.id)}
                className="flex items-start gap-3 p-4 rounded-xl border bg-white hover:border-violet-200 hover:shadow-soft transition-all text-left group">
                <div className={`${item.color} w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-4 h-4"/>
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Stage 1 ────────────────────────────────────────────────────
function Stage1Tab({ icps, onRefresh }: { icps:ICP[]; onRefresh:()=>void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    industries:'SaaS, FinTech, B2B SaaS',
    companySizeMin:'50', companySizeMax:'2000',
    targetTitles:'VP Sales, CRO, Head of Growth, Director of Sales',
    seniority:'VP, C-Suite, Director',
    geographies:'US, UK, IN',
    techSignals:'Salesforce, HubSpot, Outreach',
    painKeywords:'outbound, pipeline velocity, SDR efficiency, conversion rate',
  });
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p=>({...p,[k]:e.target.value}));

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.runResearch({
        industries: form.industries.split(',').map(s=>s.trim()).filter(Boolean),
        companySizeMin: parseInt(form.companySizeMin)||50, companySizeMax: parseInt(form.companySizeMax)||2000,
        targetTitles: form.targetTitles.split(',').map(s=>s.trim()).filter(Boolean),
        seniority: form.seniority.split(',').map(s=>s.trim()).filter(Boolean),
        geographies: form.geographies.split(',').map(s=>s.trim()).filter(Boolean),
        techSignals: form.techSignals.split(',').map(s=>s.trim()).filter(Boolean),
        painKeywords: form.painKeywords.split(',').map(s=>s.trim()).filter(Boolean),
      });
      toast({ title:`✅ ICP Created — ${res.prospectCount} prospects generated`, description: res.icp.name });
      onRefresh();
    } catch(err) { toast({ title:'Research failed', description:String(err), variant:'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Market Research</h2>
          <p className="text-sm text-muted-foreground">Define your ICP — AI generates matching prospects and competitive analysis</p>
        </div>
        <Button onClick={run} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Search className="w-4 h-4 mr-2"/>}
          {loading ? 'Researching…' : 'Run Research'}
        </Button>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-0 shadow-soft">
          <CardHeader className="pb-3 pt-6 px-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Target className="w-4 h-4 text-emerald-600"/></div>
              <div><CardTitle className="text-base">ICP Configuration</CardTitle><CardDescription>Comma-separated values for each field</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {([
                ['Industries', 'industries', 'SaaS, FinTech, B2B Commerce'],
                ['Target Titles', 'targetTitles', 'VP Sales, CRO, Head of Growth'],
                ['Seniority Levels', 'seniority', 'VP, C-Suite, Director'],
                ['Geographies', 'geographies', 'US, UK, IN, SG'],
                ['Tech Signals', 'techSignals', 'Salesforce, HubSpot, Outreach'],
              ] as [string, keyof typeof form, string][]).map(([label, key, placeholder]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
                  <Input value={form[key]} onChange={f(key)} placeholder={placeholder}
                    className="bg-white border-gray-200 text-sm focus-visible:ring-emerald-200 focus-visible:border-emerald-400" />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company Size (employees)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={form.companySizeMin} onChange={f('companySizeMin')} placeholder="50" className="bg-white border-gray-200 text-sm"/>
                  <span className="text-muted-foreground text-sm flex-shrink-0">to</span>
                  <Input type="number" value={form.companySizeMax} onChange={f('companySizeMax')} placeholder="2000" className="bg-white border-gray-200 text-sm"/>
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pain Keywords</Label>
                <Input value={form.painKeywords} onChange={f('painKeywords')} placeholder="outbound, pipeline, conversion rate, SDR efficiency"
                  className="bg-white border-gray-200 text-sm focus-visible:ring-emerald-200 focus-visible:border-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {icps.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-0 shadow-soft">
            <CardHeader className="pb-3 pt-5 px-6">
              <CardTitle className="text-base">Active ICPs <span className="ml-2 text-sm font-normal text-muted-foreground">({icps.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Accordion type="multiple" className="space-y-2">
                {icps.map(icp => {
                  const c = (icp.config||{}) as Record<string,unknown>;
                  return (
                    <AccordionItem key={icp.id} value={icp.id} className="border rounded-xl px-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <AccordionTrigger className="hover:no-underline py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4 text-emerald-600"/></div>
                          <div className="text-left min-w-0">
                            <p className="font-semibold text-sm truncate">{icp.name}</p>
                            <p className="text-xs text-muted-foreground">v{icp.version} · {icp.prospectCount} prospects</p>
                          </div>
                          <Badge variant="outline" className={`ml-auto flex-shrink-0 ${icp.active?'border-emerald-300 text-emerald-700 bg-emerald-50':''}`}>
                            {icp.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-1">
                        <div className="space-y-3 text-sm">
                          {c.summary ? <p className="text-muted-foreground leading-relaxed">{String(c.summary)}</p> : null}
                          {(['painPoints','buyingSignals','competitors'] as const).map(key => {
                            const items = c[key];
                            if (!items || !Array.isArray(items)) return null;
                            const metaMap: Record<string, [string, string]> = { painPoints:['Pain Points','bg-rose-50 text-rose-700'], buyingSignals:['Buying Signals','bg-blue-50 text-blue-700'], competitors:['Competitors','bg-orange-50 text-orange-700'] };
                            const meta = metaMap[key];
                            return (
                              <div key={key}>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{meta[0]}</p>
                                <div className="flex flex-wrap gap-1">
                                  {(items as string[]).map((item,i) => <Badge key={i} variant="secondary" className={`text-xs ${meta[1]}`}>{String(item)}</Badge>)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Stage 2 ────────────────────────────────────────────────────
function Stage2Tab({ prospects, icps, ps, onRefresh }: { prospects:Prospect[]; icps:ICP[]; ps:ProspectStats; onRefresh:()=>void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedIcp, setSelectedIcp] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const enrich = async () => {
    if (!selectedIcp) { toast({ title:'Select an ICP first', variant:'destructive' }); return; }
    setLoading(true);
    try { const r = await api.enrichProspects({ icpId:selectedIcp }); toast({ title:`✅ ${r.enriched} prospects enriched` }); onRefresh(); }
    catch(err) { toast({ title:'Enrichment failed', description:String(err), variant:'destructive' }); }
    finally { setLoading(false); }
  };

  const filtered = prospects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => !search || p.contact.full_name.toLowerCase().includes(search.toLowerCase()) || p.company.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Prospect Profiling</h2>
          <p className="text-sm text-muted-foreground">
            <span className="text-red-600 font-semibold">{ps.hot} hot</span> · <span className="text-amber-600 font-semibold">{ps.warm} warm</span> · <span className="text-slate-500">{ps.cold} cold</span> · {ps.total} total
          </p>
        </div>
        <Button onClick={enrich} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-soft">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Users className="w-4 h-4 mr-2"/>}
          {loading ? 'Enriching…' : 'Enrich Prospects'}
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        <Select value={selectedIcp} onValueChange={setSelectedIcp}>
          <SelectTrigger className="w-48 bg-white text-sm h-9"><SelectValue placeholder="Select ICP"/></SelectTrigger>
          <SelectContent>{icps.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 bg-white text-sm h-9"><SelectValue placeholder="All Status"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="hot">🔴 Hot</SelectItem>
            <SelectItem value="warm">🟡 Warm</SelectItem>
            <SelectItem value="cold">⚪ Cold</SelectItem>
            <SelectItem value="contacted">📬 Contacted</SelectItem>
          </SelectContent>
        </Select>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or company…"
          className="w-52 bg-white text-sm h-9 border-gray-200" />
        {(filter !== 'all' || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilter('all'); setSearch(''); }} className="h-9 text-xs text-muted-foreground">
            Clear filters
          </Button>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-0 shadow-soft overflow-hidden">
          <ScrollArea className="max-h-[560px]">
            {filtered.length === 0 ? (
              <EmptyState icon={<Users className="w-6 h-6"/>} title={prospects.length === 0 ? "No prospects yet" : "No matches"}
                desc={prospects.length === 0 ? "Run Research first to generate your prospect list" : "Try changing your filters"} />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white border-b">
                  <tr>{['Contact','Company','ICP Score','Intent','Status'].map(h=>(
                    <th key={h} className="text-left p-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider first-of-type:pl-5 last-of-type:pr-5">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {p.contact.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{p.contact.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.contact.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3 h-3 text-gray-400"/>
                          </div>
                          <div>
                            <p className="font-medium text-xs">{p.company.name}</p>
                            <p className="text-xs text-muted-foreground">{p.company.industry}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5"><ScoreBar value={p.icpScore} color="bg-amber-500"/></td>
                      <td className="p-3.5"><ScoreBar value={p.intentScore} color="bg-blue-500"/></td>
                      <td className="p-3.5 pr-5"><Badge variant="outline" className={`text-xs ${statusColor(p.status)}`}>{p.status.charAt(0).toUpperCase()+p.status.slice(1)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Stage 3 ────────────────────────────────────────────────────
function Stage3Tab({ signals, onRefresh }: { signals:Signal[]; onRefresh:()=>void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const collect = async () => {
    setLoading(true);
    try { const r = await api.collectSignals(); toast({ title:`✅ ${r.totalSignals} signals detected across ${r.prospectsProcessed} prospects` }); onRefresh(); }
    catch(err) { toast({ title:'Collection failed', description:String(err), variant:'destructive' }); }
    finally { setLoading(false); }
  };

  const byType = signals.reduce<Record<string,number>>((a,s)=>{ a[s.signalType]=(a[s.signalType]||0)+1; return a; },{});
  const chartData = Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  const filtered = typeFilter === 'all' ? signals : signals.filter(s => s.signalType === typeFilter);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Intent Signals</h2>
          <p className="text-sm text-muted-foreground">{signals.length} signals · {Object.keys(byType).length} signal types</p>
        </div>
        <Button onClick={collect} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-soft">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Activity className="w-4 h-4 mr-2"/>}
          {loading ? 'Collecting…' : 'Collect Signals'}
        </Button>
      </motion.div>

      {chartData.length > 0 && (
        <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-soft">
            <CardHeader className="pb-1 pt-5 px-6"><CardTitle className="text-sm font-semibold">Signal Distribution</CardTitle></CardHeader>
            <CardContent className="px-6 pb-5">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{top:0,right:4,bottom:0,left:-28}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="name" tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <RTooltip />
                    <Bar dataKey="value" radius={[5,5,0,0]}>{chartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Top Signal Types</p>
            {chartData.slice(0,5).map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-100 transition-colors cursor-pointer"
                onClick={() => setTypeFilter(typeFilter === item.name ? 'all' : item.name)}>
                <span className="text-sm font-bold text-muted-foreground w-4">{i+1}</span>
                <Badge variant="secondary" className={`text-xs flex-shrink-0 ${signalColor(item.name)}`}>{item.name.replace('_',' ')}</Badge>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-1.5 rounded-full bg-blue-400" style={{width:`${Math.round((item.value/chartData[0].value)*100)}%`}} />
                </div>
                <span className="text-sm font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        {typeFilter !== 'all' && (
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className={signalColor(typeFilter)}>{typeFilter.replace('_',' ')}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setTypeFilter('all')} className="h-6 text-xs">Clear filter</Button>
          </div>
        )}
        <Card className="border-0 shadow-soft">
          <ScrollArea className="max-h-[480px]">
            {filtered.length === 0 ? (
              <EmptyState icon={<Activity className="w-6 h-6"/>} title="No signals yet" desc="Click Collect Signals to detect buying intent across your prospects" />
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <div key={s.id} className="p-4 hover:bg-blue-50/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${signalColor(s.signalType)}`}>
                        <Zap className="w-3.5 h-3.5"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="secondary" className={`text-xs ${signalColor(s.signalType)}`}>{s.signalType.replace('_',' ')}</Badge>
                          <span className="text-xs text-muted-foreground">via {s.source}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3"/>{new Date(s.detectedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{s.humanSummary}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.prospect.contact.full_name} · <span className="font-medium">{s.prospect.company.name}</span></p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-bold text-amber-600">{Math.round(s.weight * 100)}</span>
                          <p className="text-[10px] text-muted-foreground">weight</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ── Stage 4 ────────────────────────────────────────────────────
function Stage4Tab({ drafts, prospects, onRefresh }: { drafts:DraftEmail[]; prospects:Prospect[]; onRefresh:()=>void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DraftEmail|null>(null);
  const [copied, setCopied] = useState(false);
  const needEmails = prospects.filter(p=>(p.status==='hot'||p.status==='warm')&&p.draftCount===0);

  const generate = async () => {
    if (!needEmails.length) { toast({ title:'All hot/warm prospects already have drafts' }); return; }
    setLoading(true);
    try {
      const r = await api.generateBatch(needEmails.map(p=>p.id));
      toast({ title:`✅ ${r.created} emails generated`, description: r.errors > 0 ? `${r.errors} errors` : undefined });
      onRefresh();
    } catch(err) { toast({ title:'Generation failed', description:String(err), variant:'destructive' }); }
    finally { setLoading(false); }
  };

  const copyEmail = async (body: string) => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusGroups = {
    pending: drafts.filter(d=>d.status==='pending'),
    approved: drafts.filter(d=>d.status==='approved'),
    sent: drafts.filter(d=>d.status==='sent'),
    skipped: drafts.filter(d=>d.status==='skipped'),
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Content Generation</h2>
          <p className="text-sm text-muted-foreground">{drafts.length} drafts · {needEmails.length} prospects need emails</p>
        </div>
        <Button onClick={generate} disabled={loading || !needEmails.length} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-soft">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
          {loading ? 'Generating…' : `Generate All (${needEmails.length})`}
        </Button>
      </motion.div>

      {/* Status pills */}
      {drafts.length > 0 && (
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          {Object.entries(statusGroups).filter(([,v])=>v.length>0).map(([status,items]) => (
            <div key={status} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(status)}`}>
              <span>{items.length}</span><span>{status}</span>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card className="border-0 shadow-soft overflow-hidden">
          <ScrollArea className="max-h-[540px]">
            {drafts.length === 0 ? (
              <EmptyState icon={<Mail className="w-6 h-6"/>} title="No drafts yet" desc="Generate emails for your hot & warm prospects. AI crafts personalised copy using their signals and ICP pain points." />
            ) : (
              <div className="divide-y divide-gray-50">
                {drafts.map(d => (
                  <div key={d.id} className="p-4 hover:bg-purple-50/15 transition-colors cursor-pointer group" onClick={()=>setPreview(d)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                        {d.prospect.contact.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={`text-xs ${statusColor(d.status)}`}>{d.status}</Badge>
                          <span className="text-xs font-medium">{d.prospect.contact.full_name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{d.prospect.company.name}</span>
                        </div>
                        <p className="text-sm font-semibold truncate mb-0.5">{d.editedSubject || d.subjectLines[0] || 'No subject'}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">{(d.editedBody||d.body).substring(0,120)}…</p>
                        <div className="flex gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{d.wordCount}w</span>
                          <span className={`text-[10px] font-medium ${d.spamScore<=3?'text-emerald-600':d.spamScore<=5?'text-amber-600':'text-rose-600'}`}>spam {d.spamScore.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground">grade {d.readabilityGrade.toFixed(1)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-500 transition-colors flex-shrink-0 mt-1"/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </motion.div>

      {/* Email preview dialog */}
      <Dialog open={!!preview} onOpenChange={()=>setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Email Preview
                  <Badge variant="outline" className={`text-xs ml-2 ${statusColor(preview.status)}`}>{preview.status}</Badge>
                </DialogTitle>
                <DialogDescription>{preview.prospect.contact.full_name} · {preview.prospect.contact.title} · {preview.prospect.company.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Subject Lines</p>
                  <div className="space-y-1.5">
                    {preview.subjectLines.map((s,i) => (
                      <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${i===0?'bg-purple-50 border border-purple-200':'bg-gray-50 text-muted-foreground'}`}>
                        <span className="text-xs opacity-50 font-mono">#{i+1}</span>
                        <span className={i===0?'font-medium':''}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator/>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Email Body</p>
                    <Button variant="ghost" size="sm" onClick={()=>copyEmail(preview.editedBody||preview.body)} className="h-7 text-xs gap-1.5">
                      {copied ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl text-sm whitespace-pre-wrap font-mono leading-relaxed border text-gray-700">
                    {preview.editedBody || preview.body}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[['Spam Score', preview.spamScore.toFixed(1), preview.spamScore<=3?'text-emerald-600':preview.spamScore<=5?'text-amber-600':'text-rose-600'],
                    ['Readability', `Grade ${preview.readabilityGrade.toFixed(1)}`, 'text-blue-600'],
                    ['Word Count', preview.wordCount, 'text-purple-600']].map(([l,v,c])=>(
                    <div key={String(l)} className="text-center p-3 bg-gray-50 rounded-xl border">
                      <p className="text-xs text-muted-foreground mb-1">{l}</p>
                      <p className={`text-lg font-bold ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
                {preview.prospect.topSignals?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Signals Used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.prospect.topSignals.map((s,i) => (
                        <Badge key={i} variant="secondary" className={`text-xs ${signalColor(s.signalType)}`}>{s.humanSummary.substring(0,50)}…</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {preview.personalisationTokens.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personalisation Tokens</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.personalisationTokens.map((t,i) => <Badge key={i} variant="outline" className="text-xs font-mono bg-purple-50 border-purple-200 text-purple-700">{t}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Stage 5 ────────────────────────────────────────────────────
function Stage5Tab({ queue, sent, es, onRefresh }: { queue:DraftEmail[]; sent:SentEmail[]; es:EmailStats; onRefresh:()=>void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editDraft, setEditDraft] = useState<DraftEmail|null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const approve = async (id:string) => {
    try { await api.approveDraft(id,'approve',{}); toast({ title:'✅ Approved for sending' }); onRefresh(); }
    catch(err) { toast({ title:'Failed', description:String(err), variant:'destructive' }); }
  };
  const skip = async (id:string) => {
    try { await api.approveDraft(id,'skip'); toast({ title:'Skipped' }); onRefresh(); }
    catch(err) { toast({ title:'Failed', description:String(err), variant:'destructive' }); }
  };
  const openEdit = (d:DraftEmail) => { setEditDraft(d); setEditSubject(d.editedSubject||d.subjectLines[0]||''); setEditBody(d.editedBody||d.body); };
  const saveEdit = async () => {
    if (!editDraft) return;
    try { await api.approveDraft(editDraft.id,'edit',{ editedSubject:editSubject, editedBody:editBody }); toast({ title:'✅ Edited & Approved' }); setEditDraft(null); onRefresh(); }
    catch(err) { toast({ title:'Failed', description:String(err), variant:'destructive' }); }
  };
  const sendAll = async () => {
    setLoading(true);
    try {
      const r = await api.sendAll();
      toast({ title:`✅ ${r.sent} emails sent`, description: (r as any).provider === 'sendgrid' ? 'Delivered via SendGrid' : 'Demo mode — add SENDGRID_API_KEY for real delivery' });
      onRefresh();
    } catch(err) { toast({ title:'Send failed', description:String(err), variant:'destructive' }); }
    finally { setLoading(false); }
  };

  const pending = queue.filter(d=>d.status==='pending').length;
  const approved = queue.filter(d=>d.status==='approved').length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Approval & Send</h2>
          <p className="text-sm text-muted-foreground"><span className="text-amber-600 font-semibold">{pending} pending</span> review · <span className="text-emerald-600 font-semibold">{approved} approved</span> ready to send</p>
        </div>
        <Button onClick={sendAll} disabled={loading || approved===0} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-soft">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2"/>}
          {loading ? 'Sending…' : `Send All Approved (${approved})`}
        </Button>
      </motion.div>

      {/* Stats */}
      {es.sent > 0 && (
        <motion.div variants={fadeUp} className="grid sm:grid-cols-3 gap-3">
          <KPICard label="Open Rate" value={`${es.openRate}%`} icon={<Eye className="w-5 h-5"/>} sub={`${es.opened} of ${es.sent} opened`} accent="emerald"/>
          <KPICard label="Reply Rate" value={`${es.replyRate}%`} icon={<MessageSquare className="w-5 h-5"/>} sub={`${es.replied} replied`} accent="blue"/>
          <KPICard label="Bounce Rate" value={`${es.bounceRate}%`} icon={<AlertTriangle className="w-5 h-5"/>} sub={`${es.bounced} bounced`} accent="rose"/>
        </motion.div>
      )}

      {/* Approval queue */}
      {queue.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-0 shadow-soft">
            <CardHeader className="pb-3 pt-5 px-6">
              <CardTitle className="text-base flex items-center gap-2">
                Approval Queue
                {pending > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">{pending} pending</span>}
                {approved > 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">{approved} approved</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="max-h-[460px]">
                <div className="divide-y divide-gray-50">
                  {queue.map(d => (
                    <div key={d.id} className="px-6 py-4 hover:bg-rose-50/20 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {d.prospect.contact.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={`text-xs ${statusColor(d.status)}`}>{d.status}</Badge>
                            <span className="font-semibold text-sm">{d.prospect.contact.full_name}</span>
                            <span className="text-xs text-muted-foreground">{d.prospect.contact.title}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-medium">{d.prospect.company.name}</span>
                          </div>
                          <div className="flex gap-4 mb-2 text-xs text-muted-foreground">
                            <span>ICP <strong className="text-foreground">{Math.round(d.prospect.icpScore)}</strong></span>
                            <span>Intent <strong className="text-foreground">{Math.round(d.prospect.intentScore)}</strong></span>
                            <span>Spam <strong className={d.spamScore<=3?'text-emerald-600':d.spamScore<=5?'text-amber-600':'text-rose-600'}>{d.spamScore.toFixed(1)}</strong></span>
                            <span>{d.wordCount}w</span>
                          </div>
                          {d.prospect.topSignals?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {d.prospect.topSignals.slice(0,2).map((s,i) => (
                                <Badge key={i} variant="secondary" className={`text-[10px] ${signalColor(s.signalType)}`}>{s.humanSummary.substring(0,48)}…</Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{(d.editedBody||d.body).substring(0,160)}…</p>
                        </div>
                        {d.status === 'pending' && (
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <TooltipProvider><Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={()=>approve(d.id)} className="h-8 w-8 p-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50">
                                  <Check className="w-3.5 h-3.5"/>
                                </Button>
                              </TooltipTrigger><TooltipContent side="left">Approve</TooltipContent>
                            </Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={()=>openEdit(d)} className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50">
                                  <Edit3 className="w-3.5 h-3.5"/>
                                </Button>
                              </TooltipTrigger><TooltipContent side="left">Edit & Approve</TooltipContent>
                            </Tooltip></TooltipProvider>
                            <TooltipProvider><Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={()=>skip(d.id)} className="h-8 w-8 p-0 border-gray-300 text-gray-500 hover:bg-gray-50">
                                  <SkipForward className="w-3.5 h-3.5"/>
                                </Button>
                              </TooltipTrigger><TooltipContent side="left">Skip</TooltipContent>
                            </Tooltip></TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {queue.length === 0 && sent.length === 0 && (
        <motion.div variants={fadeUp}>
          <EmptyState icon={<Send className="w-6 h-6"/>} title="No emails in queue"
            desc="Generate emails in Stage 4 then approve them here before sending." />
        </motion.div>
      )}

      {/* Sent table */}
      {sent.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-0 shadow-soft overflow-hidden">
            <CardHeader className="pb-3 pt-5 px-6"><CardTitle className="text-base">Sent Emails <span className="text-sm font-normal text-muted-foreground ml-2">({sent.length})</span></CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[380px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr>{['Recipient','Subject','Provider','Sent','Opened','Replied','Bounced'].map(h=>(
                      <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider first:pl-5 last:pr-5 text-center first:text-left">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sent.map(e => (
                      <tr key={e.id} className="hover:bg-violet-50/20 transition-colors">
                        <td className="p-3 pl-5">
                          <p className="font-semibold">{e.prospect.contact.full_name}</p>
                          <p className="text-muted-foreground">{e.recipientEmail}</p>
                        </td>
                        <td className="p-3 max-w-[160px] truncate text-muted-foreground">{e.subject}</td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px]">{e.sendProvider}</Badge></td>
                        <td className="p-3 text-muted-foreground">{new Date(e.sentAt).toLocaleDateString()}</td>
                        <td className="p-3 text-center">{e.openedAt ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/> : <Circle className="w-4 h-4 text-gray-200 mx-auto"/>}</td>
                        <td className="p-3 text-center">{e.repliedAt ? <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto"/> : <Circle className="w-4 h-4 text-gray-200 mx-auto"/>}</td>
                        <td className="p-3 pr-5 text-center">{e.bounced ? <AlertTriangle className="w-4 h-4 text-rose-500 mx-auto"/> : <Circle className="w-4 h-4 text-gray-200 mx-auto"/>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editDraft} onOpenChange={()=>setEditDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editDraft && (
            <>
              <DialogHeader>
                <DialogTitle>Edit & Approve Email</DialogTitle>
                <DialogDescription>{editDraft.prospect.contact.full_name} · {editDraft.prospect.contact.title} · {editDraft.prospect.company.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject Line</Label>
                  <Input value={editSubject} onChange={e=>setEditSubject(e.target.value)} className="bg-white focus-visible:ring-violet-200 focus-visible:border-violet-400"/>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email Body</Label>
                    <span className="text-xs text-muted-foreground">{editBody.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <Textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={13}
                    className="font-mono text-xs bg-white leading-relaxed focus-visible:ring-violet-200 focus-visible:border-violet-400"/>
                </div>
              </div>
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={()=>setEditDraft(null)}>Cancel</Button>
                <Button onClick={saveEdit} className="bg-violet-600 hover:bg-violet-700 text-white font-semibold">
                  <Check className="w-4 h-4 mr-1.5"/>Save & Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Main app ───────────────────────────────────────────────────
const TABS = [
  { id:'overview', label:'Overview', icon:BarChart3 },
  { id:'stage1',   label:'Research', icon:Search },
  { id:'stage2',   label:'Prospects', icon:Users },
  { id:'stage3',   label:'Signals',  icon:Activity },
  { id:'stage4',   label:'Generate', icon:Sparkles },
  { id:'stage5',   label:'Send',     icon:Send },
];

const TAB_COLORS: Record<string,string> = {
  overview:'text-violet-600', stage1:'text-emerald-600', stage2:'text-amber-600',
  stage3:'text-blue-600', stage4:'text-purple-600', stage5:'text-rose-600',
};

export default function SDRAutopilot() {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [llm, setLlm] = useState<LLMConfig|null>(null);
  const [stats, setStats] = useState<PipelineStats>({ icps:0, prospects:0, signals:0, drafts:0, sentEmails:0 });
  const [ps, setPs] = useState<ProspectStats>({ total:0, hot:0, warm:0, cold:0 });
  const [es, setEs] = useState<EmailStats>({ sent:0, opened:0, replied:0, bounced:0, openRate:0, replyRate:0, bounceRate:0 });
  const [icps, setIcps] = useState<ICP[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [queue, setQueue] = useState<DraftEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [health, icpsR, prospectsR, statsR, signalsR, queueR, sentR, configR] = await Promise.allSettled([
        api.health(), api.getICPs(), api.getProspects({ perPage:200 }),
        api.getProspectStats(), api.getSignals({ perPage:200 }),
        api.getApprovalQueue({ perPage:200 }), api.getSentEmails({ perPage:200 }),
        fetch('/api/config').then(r=>r.json()).catch(()=>null),
      ]);
      if (health.status==='fulfilled') setStats(health.value.counts);
      if (icpsR.status==='fulfilled') setIcps(icpsR.value.icps);
      if (prospectsR.status==='fulfilled') setProspects(prospectsR.value.prospects);
      if (statsR.status==='fulfilled') setPs(statsR.value);
      if (signalsR.status==='fulfilled') setSignals(signalsR.value.signals);
      if (queueR.status==='fulfilled') { setQueue(queueR.value.drafts); setDrafts(queueR.value.drafts); }
      if (sentR.status==='fulfilled') { setSent(sentR.value.emails); setEs(sentR.value.stats); }
      if (configR.status==='fulfilled' && configR.value) setLlm(configR.value);
    } finally { setBooting(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const runPipeline = async () => {
    setPipelineRunning(true);
    try {
      const r = await api.runPipeline({
        industries:['SaaS','FinTech'], companySizeMin:50, companySizeMax:1000,
        targetTitles:['VP Sales','CRO','Head of Growth'],
        seniority:['VP','C-Suite','Director'],
        geographies:['US','UK'],
        techSignals:['Salesforce','HubSpot'],
        painKeywords:['outbound','pipeline','conversion'],
      });
      toast({
        title:'🚀 Pipeline complete!',
        description:`${r.pipeline.stage2.prospectsEnriched} prospects · ${r.pipeline.stage3.signalsCollected} signals · ${r.pipeline.stage4.draftsGenerated} drafts — review in Send tab`,
      });
      await refresh();
      setTab('stage5');
    } catch(err) { toast({ title:'Pipeline failed', description:String(err), variant:'destructive' }); }
    finally { setPipelineRunning(false); }
  };

  const resetAll = async () => {
    if (!confirm('Reset all data? This cannot be undone.')) return;
    try { await api.resetAll(); toast({ title:'Data reset' }); await refresh(); setTab('overview'); }
    catch(err) { toast({ title:'Reset failed', description:String(err), variant:'destructive' }); }
  };

  if (booting) {
    return (
      <div className="min-h-screen mesh-bg flex flex-col">
        <div className="h-14 border-b bg-white/80"/>
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-52"/>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-28 rounded-xl"/>)}
          </div>
          <Skeleton className="h-64 rounded-xl"/>
          <Skeleton className="h-48 rounded-xl"/>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="h-14 border-b bg-white/85 backdrop-blur-md sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <Rocket className="w-4 h-4 text-white"/>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm leading-none">SDR Autopilot</span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">by RAYR</p>
            </div>
          </div>

          {/* Tab nav */}
          <nav className="flex items-center gap-0.5 bg-gray-100/90 rounded-xl p-1 flex-1 max-w-[520px] mx-3 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex-1 justify-center whitespace-nowrap min-w-0 ${
                  tab===t.id ? `bg-white shadow-soft ${TAB_COLORS[t.id]}` : 'text-muted-foreground hover:text-foreground'
                }`}>
                <t.icon className="w-3.5 h-3.5 flex-shrink-0"/>
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProviderPill config={llm}/>
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={refresh} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3.5 h-3.5"/>
                </Button>
              </TooltipTrigger><TooltipContent>Refresh data</TooltipContent></Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5"/>
                </Button>
              </TooltipTrigger><TooltipContent>Reset all data</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.16, ease:'easeOut' }}>
            {tab==='overview' && <OverviewTab stats={stats} ps={ps} es={es} llm={llm} onRun={runPipeline} onNav={setTab} running={pipelineRunning}/>}
            {tab==='stage1'   && <Stage1Tab icps={icps} onRefresh={refresh}/>}
            {tab==='stage2'   && <Stage2Tab prospects={prospects} icps={icps} ps={ps} onRefresh={refresh}/>}
            {tab==='stage3'   && <Stage3Tab signals={signals} onRefresh={refresh}/>}
            {tab==='stage4'   && <Stage4Tab drafts={drafts} prospects={prospects} onRefresh={refresh}/>}
            {tab==='stage5'   && <Stage5Tab queue={queue} sent={sent} es={es} onRefresh={refresh}/>}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t bg-white/60 backdrop-blur-sm py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>SDR Autopilot · <strong className="text-foreground">Adithya Sharma</strong> · RAYR Product Suite</span>
          <a href="https://github.com/Rayr-06/sdr-auto-rayr" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Globe className="w-3 h-3"/>GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
