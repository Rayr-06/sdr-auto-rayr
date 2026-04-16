import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function sendViaSendGrid(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@sdrauto.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'SDR Autopilot';

  if (!apiKey || apiKey === 'demo') {
    // Demo mode — simulate send with realistic open/reply rates
    return { success: true, messageId: `demo_${Date.now()}_${Math.random().toString(36).slice(2,8)}` };
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: body }],
        tracking_settings: { click_tracking: { enable: true }, open_tracking: { enable: true } },
      }),
    });

    if (res.ok) {
      return { success: true, messageId: res.headers.get('x-message-id') || undefined };
    }
    const err = await res.text();
    return { success: false, error: err };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function POST() {
  try {
    const approvedDrafts = await db.draftEmail.findMany({
      where: { status: 'approved' },
      include: { prospect: true },
    });

    if (approvedDrafts.length === 0) {
      return NextResponse.json({ message: 'No approved drafts to send', sent: 0 });
    }

    const isDemoMode = !process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'demo';
    const results: Array<{ draftId: string; sentEmailId: string; recipient: string }> = [];
    const errors: Array<{ draftId: string; error: string }> = [];

    for (const draft of approvedDrafts) {
      try {
        const contact = JSON.parse(draft.prospect.contact);
        const subjectLines: string[] = JSON.parse(draft.subjectLines);
        const finalSubject = draft.editedSubject || subjectLines[draft.selectedSubject ?? 0] || subjectLines[0];
        const finalBody = draft.editedBody || draft.body;
        const recipientEmail = contact.email || `prospect@example.com`;
        const trackingId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const sendResult = await sendViaSendGrid(recipientEmail, finalSubject, finalBody);

        if (!sendResult.success) {
          errors.push({ draftId: draft.id, error: sendResult.error || 'Send failed' });
          continue;
        }

        const sentEmail = await db.sentEmail.create({
          data: {
            draftId: draft.id,
            prospectId: draft.prospectId,
            recipientEmail,
            subject: finalSubject,
            body: finalBody,
            sendProvider: isDemoMode ? 'demo' : 'sendgrid',
            trackingId,
            sentAt: new Date(),
            // Demo mode: simulate realistic engagement metrics
            openedAt: isDemoMode && Math.random() > 0.45 ? new Date(Date.now() + Math.random() * 86400000) : null,
            openCount: isDemoMode && Math.random() > 0.45 ? Math.floor(Math.random() * 4) + 1 : 0,
            repliedAt: isDemoMode && Math.random() > 0.72 ? new Date(Date.now() + Math.random() * 172800000) : null,
            replyText: isDemoMode && Math.random() > 0.72 ? "Thanks for reaching out — this looks interesting. Can we schedule a quick call this week?" : null,
            replySentiment: isDemoMode && Math.random() > 0.72 ? 'positive' : null,
            bounced: isDemoMode ? Math.random() > 0.92 : false,
          },
        });

        await db.draftEmail.update({ where: { id: draft.id }, data: { status: 'sent' } });
        await db.prospect.update({ where: { id: draft.prospectId }, data: { status: 'contacted' } });

        results.push({ draftId: draft.id, sentEmailId: sentEmail.id, recipient: recipientEmail });
      } catch (err) {
        errors.push({ draftId: draft.id, error: String(err) });
      }
    }

    return NextResponse.json({ sent: results.length, errors: errors.length, provider: isDemoMode ? 'demo' : 'sendgrid', results });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send emails', details: String(error) }, { status: 500 });
  }
}
