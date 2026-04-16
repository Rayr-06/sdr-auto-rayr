import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);
    const signalType = searchParams.get('signalType') || undefined;

    const where: Record<string, unknown> = {};
    if (signalType) where.signalType = signalType;

    const [signals, total] = await Promise.all([
      db.signal.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          prospect: {
            select: {
              id: true,
              contact: true,
              company: true,
              status: true,
            },
          },
        },
      }),
      db.signal.count({ where }),
    ]);

    const parsedSignals = signals.map((s) => ({
      ...s,
      rawData: JSON.parse(s.rawData),
      prospect: {
        ...s.prospect,
        contact: JSON.parse(s.prospect.contact),
        company: JSON.parse(s.prospect.company),
      },
    }));

    return NextResponse.json({
      signals: parsedSignals,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Failed to fetch signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}
