import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateColdEmail } from '@/lib/llm';
import type { ICPConfig } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospectId, icpId } = body;

    if (!prospectId) {
      return NextResponse.json({ error: 'prospectId is required' }, { status: 400 });
    }

    const prospect = await db.prospect.findUnique({
      where: { id: prospectId },
      include: {
        signals: { orderBy: { weight: 'desc' }, take: 5 },
        icp: true,
      },
    });

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const contact = JSON.parse(prospect.contact) as { full_name: string; email: string; title: string };
    const company = JSON.parse(prospect.company) as {
      name: string;
      domain: string;
      size: string;
      industry: string;
      revenue: string;
    };
    const icpConfig: ICPConfig = prospect.icp ? JSON.parse(prospect.icp.config) : {};
    const signals = prospect.signals.map((s) => ({
      signalType: s.signalType,
      humanSummary: s.humanSummary,
      weight: s.weight,
    }));

    // Use the enhanced generateColdEmail function which uses LLM
    // to generate personalized emails with subject lines, spam score, readability
    const emailResult = await generateColdEmail(contact, company, signals, icpConfig);

    // Check if draft already exists for this prospect
    const existingDraft = await db.draftEmail.findFirst({
      where: { prospectId, status: 'pending' },
    });

    if (existingDraft) {
      return NextResponse.json({
        message: 'Draft already exists for this prospect',
        draft: {
          ...existingDraft,
          subjectLines: JSON.parse(existingDraft.subjectLines),
          personalisationTokens: JSON.parse(existingDraft.personalisationTokens),
          generationMetadata: JSON.parse(existingDraft.generationMetadata),
        },
      });
    }

    const draft = await db.draftEmail.create({
      data: {
        prospectId,
        icpId: icpId || prospect.icpId,
        subjectLines: JSON.stringify(emailResult.subjectLines),
        body: emailResult.body,
        personalisationTokens: JSON.stringify(emailResult.personalisationTokens),
        generationMetadata: JSON.stringify({
          model: 'llm-generated',
          icpScore: prospect.icpScore,
          intentScore: prospect.intentScore,
          signalsUsed: signals.length,
          generatedAt: new Date().toISOString(),
        }),
        spamScore: emailResult.spamScore,
        readabilityGrade: emailResult.readabilityGrade,
        wordCount: emailResult.wordCount,
        status: 'pending',
      },
    });

    return NextResponse.json({
      draft: {
        ...draft,
        subjectLines: JSON.parse(draft.subjectLines),
        personalisationTokens: JSON.parse(draft.personalisationTokens),
        generationMetadata: JSON.parse(draft.generationMetadata),
      },
    });
  } catch (error) {
    console.error('Email generation failed:', error);
    return NextResponse.json(
      { error: 'Email generation failed', details: String(error) },
      { status: 500 }
    );
  }
}
