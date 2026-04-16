import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const icpId = searchParams.get('icpId') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);

    const where: Record<string, unknown> = {};
    if (icpId) where.icpId = icpId;
    if (status) where.status = status;

    const [prospects, total] = await Promise.all([
      db.prospect.findMany({
        where,
        orderBy: { icpScore: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          icp: {
            select: { name: true },
          },
          _count: {
            select: { signals: true, drafts: true },
          },
        },
      }),
      db.prospect.count({ where }),
    ]);

    const parsedProspects = prospects.map((p) => ({
      ...p,
      contact: JSON.parse(p.contact),
      company: JSON.parse(p.company),
      icpName: p.icp.name,
      signalCount: p._count.signals,
      draftCount: p._count.drafts,
    }));

    return NextResponse.json({
      prospects: parsedProspects,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Failed to fetch prospects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prospects' },
      { status: 500 }
    );
  }
}
