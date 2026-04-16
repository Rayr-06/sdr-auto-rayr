import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [icpCount, prospectCount, signalCount, draftCount, sentCount] = await Promise.all([
      db.iCP.count(),
      db.prospect.count(),
      db.signal.count(),
      db.draftEmail.count(),
      db.sentEmail.count(),
    ]);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      counts: {
        icps: icpCount,
        prospects: prospectCount,
        signals: signalCount,
        drafts: draftCount,
        sentEmails: sentCount,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database connection failed' },
      { status: 503 }
    );
  }
}
