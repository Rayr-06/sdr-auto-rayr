import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateColdEmail } from '@/lib/llm';
import type { ICPConfig } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospectIds, icpId } = body;

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array is required' }, { status: 400 });
    }

    const prospects = await db.prospect.findMany({
      where: {
        id: { in: prospectIds },
      },
      include: {
        signals: { orderBy: { weight: 'desc' }, take: 3 },
        icp: true,
      },
    });

    const results: Array<{ prospectId: string; draftId: string; status: string }> = [];
    const errors: Array<{ prospectId: string; error: string }> = [];

    for (const prospect of prospects) {
      try {
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

        // Skip if draft already exists
        const existingDraft = await db.draftEmail.findFirst({
          where: { prospectId: prospect.id, status: 'pending' },
        });

        if (existingDraft) {
          results.push({
            prospectId: prospect.id,
            draftId: existingDraft.id,
            status: 'already_exists',
          });
          continue;
        }

        // Use the enhanced generateColdEmail function which uses LLM
        // for personalized email generation with spam score and readability
        const emailResult = await generateColdEmail(contact, company, signals, icpConfig);

        const draft = await db.draftEmail.create({
          data: {
            prospectId: prospect.id,
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

        results.push({
          prospectId: prospect.id,
          draftId: draft.id,
          status: 'created',
        });
      } catch (err) {
        errors.push({
          prospectId: prospect.id,
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      total: prospectIds.length,
      created: results.filter((r) => r.status === 'created').length,
      alreadyExisted: results.filter((r) => r.status === 'already_exists').length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch email generation failed:', error);
    return NextResponse.json(
      { error: 'Batch email generation failed', details: String(error) },
      { status: 500 }
    );
  }
}
