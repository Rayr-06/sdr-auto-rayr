import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  // Require admin secret to prevent accidental/malicious resets
  const secret = request.headers.get('x-admin-secret') || request.nextUrl.searchParams.get('secret');
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.sentEmail.deleteMany();
    await db.draftEmail.deleteMany();
    await db.signal.deleteMany();
    await db.prospect.deleteMany();
    await db.iCP.deleteMany();
    return NextResponse.json({ success: true, message: 'All data has been deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset data', details: String(error) }, { status: 500 });
  }
}
