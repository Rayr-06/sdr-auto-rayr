import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);

    const includeAll = searchParams.get('includeAll') === 'true';
    const where: Record<string, unknown> = includeAll ? {} : { status: 'pending' };

    const [drafts, total] = await Promise.all([
      db.draftEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          prospect: {
            select: {
              id: true,
              contact: true,
              company: true,
              icpScore: true,
              intentScore: true,
              status: true,
              signals: {
                orderBy: { weight: 'desc' },
                take: 3,
              },
            },
          },
        },
      }),
      db.draftEmail.count({ where }),
    ]);

    const parsedDrafts = drafts.map((d) => ({
      ...d,
      subjectLines: JSON.parse(d.subjectLines),
      personalisationTokens: JSON.parse(d.personalisationTokens),
      generationMetadata: JSON.parse(d.generationMetadata),
      prospect: {
        ...d.prospect,
        contact: JSON.parse(d.prospect.contact),
        company: JSON.parse(d.prospect.company),
        topSignals: d.prospect.signals.map((s) => ({
          signalType: s.signalType,
          humanSummary: s.humanSummary,
          weight: s.weight,
        })),
      },
    }));

    return NextResponse.json({
      drafts: parsedDrafts,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Failed to fetch queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email queue' },
      { status: 500 }
    );
  }
}
