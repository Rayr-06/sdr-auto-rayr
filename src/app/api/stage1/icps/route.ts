import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const icps = await db.iCP.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { prospects: true },
        },
      },
    });

    const parsedIcps = icps.map((icp) => ({
      ...icp,
      config: JSON.parse(icp.config),
      prospectCount: icp._count.prospects,
    }));

    return NextResponse.json({ icps: parsedIcps });
  } catch (error) {
    console.error('Failed to fetch ICPs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ICPs' },
      { status: 500 }
    );
  }
}
