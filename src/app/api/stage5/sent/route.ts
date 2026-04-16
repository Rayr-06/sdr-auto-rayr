import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '20', 10);

    const [sentEmails, total] = await Promise.all([
      db.sentEmail.findMany({
        orderBy: { sentAt: 'desc' },
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
          draft: {
            select: {
              id: true,
              subjectLines: true,
            },
          },
        },
      }),
      db.sentEmail.count(),
    ]);

    const parsedEmails = sentEmails.map((e) => ({
      ...e,
      prospect: {
        ...e.prospect,
        contact: JSON.parse(e.prospect.contact),
        company: JSON.parse(e.prospect.company),
      },
      draft: e.draft
        ? {
            ...e.draft,
            subjectLines: JSON.parse(e.draft.subjectLines),
          }
        : null,
    }));

    // Compute stats
    const [sent, opened, replied, bounced] = await Promise.all([
      db.sentEmail.count(),
      db.sentEmail.count({ where: { openedAt: { not: null } } }),
      db.sentEmail.count({ where: { repliedAt: { not: null } } }),
      db.sentEmail.count({ where: { bounced: true } }),
    ]);

    return NextResponse.json({
      emails: parsedEmails,
      stats: {
        sent,
        opened,
        replied,
        bounced,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      },
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Failed to fetch sent emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sent emails' },
      { status: 500 }
    );
  }
}
