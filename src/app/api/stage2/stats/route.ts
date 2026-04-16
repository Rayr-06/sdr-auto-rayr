import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const icpId = searchParams.get('icpId') || undefined;

    const where: Record<string, unknown> = {};
    if (icpId) where.icpId = icpId;

    const [total, hot, warm, cold] = await Promise.all([
      db.prospect.count({ where }),
      db.prospect.count({ where: { ...where, status: 'hot' } }),
      db.prospect.count({ where: { ...where, status: 'warm' } }),
      db.prospect.count({ where: { ...where, status: 'cold' } }),
    ]);

    return NextResponse.json({ total, hot, warm, cold });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
