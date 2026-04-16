import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeSignals } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospectIds } = body as { prospectIds?: string[] };

    // Get prospects to generate signals for
    const where: Record<string, unknown> = {};
    if (prospectIds && prospectIds.length > 0) {
      where.id = { in: prospectIds };
    }

    const prospects = await db.prospect.findMany({
      where,
      include: { icp: true },
    });

    if (prospects.length === 0) {
      return NextResponse.json({ error: 'No prospects found' }, { status: 404 });
    }

    const results: Array<{ prospectId: string; signalsCreated: number }> = [];

    for (const prospect of prospects) {
      const contact = JSON.parse(prospect.contact) as { full_name: string; title: string };
      const company = JSON.parse(prospect.company) as {
        name: string;
        domain: string;
        size: string;
        industry: string;
        revenue: string;
      };

      // Use the enhanced analyzeSignals function which uses LLM
      // to generate realistic, industry-specific signals
      const signalsToCreate = await analyzeSignals(contact, company);

      let signalsCreated = 0;

      for (const signalData of signalsToCreate) {
        const signalType = signalData.signalType || 'news';
        const source = signalData.source || 'demo';
        const weight = signalData.weight || (0.3 + Math.random() * 0.6);
        const humanSummary = signalData.humanSummary || 'Intent signal detected';
        const rawData = signalData.rawData ? JSON.stringify(signalData.rawData) : '{}';

        await db.signal.create({
          data: {
            prospectId: prospect.id,
            signalType,
            source,
            weight: Math.round(weight * 100) / 100,
            humanSummary,
            rawData,
            detectedAt: new Date(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          },
        });

        signalsCreated++;
      }

      // Update prospect intent score based on signals
      const totalWeight = signalsToCreate.reduce(
        (sum, s) => sum + (s.weight || 0.5),
        0
      );
      const avgWeight = totalWeight / signalsToCreate.length;
      const intentScore = Math.min(100, Math.round(avgWeight * 100));

      await db.prospect.update({
        where: { id: prospect.id },
        data: { intentScore },
      });

      results.push({
        prospectId: prospect.id,
        signalsCreated,
      });
    }

    return NextResponse.json({
      prospectsProcessed: results.length,
      totalSignals: results.reduce((sum, r) => sum + r.signalsCreated, 0),
      results,
    });
  } catch (error) {
    console.error('Signal collection failed:', error);
    return NextResponse.json(
      { error: 'Signal collection failed', details: String(error) },
      { status: 500 }
    );
  }
}
