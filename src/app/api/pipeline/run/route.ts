import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callLLM, parseJSONResponse, generateProspectProfiles, analyzeSignals, generateColdEmail } from '@/lib/llm';
import type { ICPConfig } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      industries = ['SaaS', 'FinTech'],
      companySizeMin = 50, companySizeMax = 1000,
      targetTitles = ['VP Sales', 'CRO', 'Head of Growth'],
      seniority = ['VP', 'C-Suite', 'Director'],
      geographies = ['US', 'UK'],
      techSignals = ['Salesforce', 'HubSpot'],
      painKeywords = ['outbound', 'pipeline', 'conversion'],
    } = body;

    const config: ICPConfig = { industries, companySizeMin, companySizeMax, targetTitles, seniority, geographies, techSignals, painKeywords };

    // ── STAGE 1: ICP Research (LLM) ────────────────────────────
    const llmICP = await callLLM(
      'You are a market research analyst specializing in B2B sales. Always respond with valid JSON only. No markdown.',
      `Analyze this target market and create an Ideal Customer Profile.
Industries: ${industries.join(', ')} | Size: ${companySizeMin}-${companySizeMax} | Titles: ${targetTitles.join(', ')} | Pain: ${painKeywords.join(', ')}
Return JSON: { name, summary, painPoints: string[], buyingSignals: string[], competitors: string[], sampleCompanies: string[] }`
    );
    const icpData = parseJSONResponse<Record<string, unknown>>(llmICP, {});
    const icpName = (icpData.name as string) || `${industries[0]} ${companySizeMin}-${companySizeMax} ICP`;

    const icp = await db.iCP.create({
      data: { name: icpName, version: 1, config: JSON.stringify({ ...config, ...icpData }), active: true },
    });

    // ── STAGE 2: Generate Prospects (LLM) ──────────────────────
    const profiles = await generateProspectProfiles(config);
    const prospectIds: string[] = [];

    for (const profile of profiles) {
      const icpScore = Math.round(profile.icpScore * 10) / 10;
      const prospect = await db.prospect.create({
        data: {
          icpId: icp.id,
          contact: JSON.stringify({ full_name: profile.full_name, email: profile.email, title: profile.title, linkedin: profile.linkedin }),
          company: JSON.stringify(profile.company),
          icpScore,
          intentScore: 0,
          status: icpScore >= 80 ? 'hot' : icpScore >= 60 ? 'warm' : 'cold',
          enrichedAt: new Date(),
        },
      });
      prospectIds.push(prospect.id);
    }

    // ── STAGE 3: Collect Signals (LLM) ─────────────────────────
    let totalSignals = 0;
    for (const prospectId of prospectIds) {
      const prospect = await db.prospect.findUnique({ where: { id: prospectId } });
      if (!prospect) continue;
      const contact = JSON.parse(prospect.contact);
      const company = JSON.parse(prospect.company);
      const signals = await analyzeSignals(contact, company);

      for (const s of signals) {
        await db.signal.create({
          data: {
            prospectId,
            signalType: s.signalType,
            source: s.source,
            weight: s.weight,
            humanSummary: s.humanSummary,
            rawData: JSON.stringify(s.rawData || {}),
            detectedAt: new Date(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        totalSignals++;
      }

      const avgWeight = signals.reduce((sum, s) => sum + s.weight, 0) / Math.max(signals.length, 1);
      await db.prospect.update({ where: { id: prospectId }, data: { intentScore: Math.min(100, Math.round(avgWeight * 100)) } });
    }

    // ── STAGE 4: Generate Emails (LLM) ─────────────────────────
    const hotProspects = await db.prospect.findMany({
      where: { icpId: icp.id, status: { in: ['hot', 'warm'] } },
      include: { signals: { orderBy: { weight: 'desc' }, take: 3 } },
    });

    const draftIds: string[] = [];
    for (const prospect of hotProspects) {
      const contact = JSON.parse(prospect.contact);
      const company = JSON.parse(prospect.company);
      const signals = prospect.signals.map(s => ({ signalType: s.signalType, humanSummary: s.humanSummary, weight: s.weight }));
      const emailResult = await generateColdEmail(contact, company, signals, config);

      const draft = await db.draftEmail.create({
        data: {
          prospectId: prospect.id,
          icpId: icp.id,
          subjectLines: JSON.stringify(emailResult.subjectLines),
          body: emailResult.body,
          personalisationTokens: JSON.stringify(emailResult.personalisationTokens),
          generationMetadata: JSON.stringify({ model: 'llm-pipeline', icpScore: prospect.icpScore, intentScore: prospect.intentScore, signalsUsed: signals.length }),
          spamScore: emailResult.spamScore,
          readabilityGrade: emailResult.readabilityGrade,
          wordCount: emailResult.wordCount,
          status: 'pending',
        },
      });
      draftIds.push(draft.id);
    }

    // ── STAGE 5: Queue for human approval (no auto-send) ───────
    // Emails stay as 'pending' — SDR reviews in the Send tab

    return NextResponse.json({
      success: true,
      pipeline: {
        stage1: { icpId: icp.id, icpName: icp.name },
        stage2: { prospectsEnriched: prospectIds.length, prospectIds },
        stage3: { signalsCollected: totalSignals },
        stage4: { draftsGenerated: draftIds.length, draftIds },
        stage5: { emailsSent: 0, message: 'Review drafts in the Send tab and approve before sending' },
      },
    });
  } catch (error) {
    console.error('Pipeline run failed:', error);
    return NextResponse.json({ error: 'Pipeline run failed', details: String(error) }, { status: 500 });
  }
}
