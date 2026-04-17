import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createEngageProspect, enrollInCadence, sendEngageEmail, getEngageCadences, isEngageConfigured } from '@/lib/engage'

async function sendViaSendGrid(to: string, subject: string, body: string) {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@sdrauto.com'
  if (!apiKey || apiKey === 'demo') return { success: true, messageId: `demo_${Date.now()}` }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || 'SDR Autopilot' },
      subject,
      content: [{ type: 'text/plain', value: body }],
      tracking_settings: { click_tracking: { enable: true }, open_tracking: { enable: true } },
    }),
  })
  if (res.ok) return { success: true, messageId: res.headers.get('x-message-id') || undefined }
  return { success: false, error: await res.text() }
}

export async function POST() {
  try {
    const approvedDrafts = await db.draftEmail.findMany({
      where: { status: 'approved' },
      include: { prospect: true },
    })

    if (!approvedDrafts.length) return NextResponse.json({ message: 'No approved drafts', sent: 0 })

    const engageEnabled = isEngageConfigured()
    const isDemoMode = !process.env.SENDGRID_API_KEY && !engageEnabled
    const results: Array<{ draftId: string; sentEmailId: string; recipient: string }> = []
    const errors: Array<{ draftId: string; error: string }> = []

    // Get Engage cadences if configured
    let defaultCadenceId: number | undefined
    const mailboxEmail = process.env.ENGAGE_MAILBOX_EMAIL || process.env.SENDGRID_FROM_EMAIL || ''
    if (engageEnabled) {
      try {
        const cadences = await getEngageCadences()
        defaultCadenceId = cadences[0]?.id
      } catch (e) { console.error('Failed to get cadences:', e) }
    }

    for (const draft of approvedDrafts) {
      try {
        const contact = JSON.parse(draft.prospect.contact) as Record<string, string>
        const company = JSON.parse(draft.prospect.company) as Record<string, string>
        const subjectLines: string[] = JSON.parse(draft.subjectLines)
        const finalSubject = draft.editedSubject || subjectLines[draft.selectedSubject ?? 0] || subjectLines[0]
        const finalBody = draft.editedBody || draft.body
        const recipientEmail = contact.email || 'prospect@example.com'
        const trackingId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        let sendProvider = 'demo'
        let engageProspectId: number | undefined
        let openedAt: Date | null = null, repliedAt: Date | null = null, bounced = false, replyText: string | null = null

        if (engageEnabled) {
          // ── ENGAGE: Create prospect + enroll in cadence ──
          try {
            const ep = await createEngageProspect({
              email: recipientEmail,
              firstName: contact.full_name?.split(' ')[0] || '',
              lastName: contact.full_name?.split(' ').slice(1).join(' ') || '',
              title: contact.title || '',
              company: company.name || '',
              phone: contact.phone,
              linkedIn: contact.linkedin,
            })
            engageProspectId = ep.id

            if (defaultCadenceId && mailboxEmail) {
              await enrollInCadence({ prospectId: ep.id, cadenceId: defaultCadenceId, mailboxEmail })
              sendProvider = 'engage-cadence'
            } else {
              await sendEngageEmail({ prospectId: ep.id, subject: finalSubject, body: finalBody, mailboxEmail })
              sendProvider = 'engage'
            }
          } catch (engageErr) {
            console.error('Engage send failed, falling back to SendGrid:', engageErr)
          }
        }

        if (!engageEnabled || sendProvider === 'demo') {
          // ── SENDGRID or DEMO ──────────────────────────────
          const result = await sendViaSendGrid(recipientEmail, finalSubject, finalBody)
          if (!result.success) { errors.push({ draftId: draft.id, error: result.error || 'Send failed' }); continue }
          sendProvider = isDemoMode ? 'demo' : 'sendgrid'

          if (isDemoMode) {
            openedAt = Math.random() > 0.45 ? new Date(Date.now() + Math.random() * 86400000) : null
            repliedAt = Math.random() > 0.72 ? new Date(Date.now() + Math.random() * 172800000) : null
            bounced = Math.random() > 0.95
            replyText = repliedAt ? "Thanks for reaching out — this looks interesting. Can we schedule a quick call?" : null
          }
        }

        const sentEmail = await db.sentEmail.create({
          data: {
            draftId: draft.id,
            prospectId: draft.prospectId,
            recipientEmail,
            subject: finalSubject,
            body: finalBody,
            sendProvider,
            trackingId,
            sentAt: new Date(),
            openedAt,
            openCount: openedAt ? 1 : 0,
            repliedAt,
            replyText,
            replySentiment: repliedAt ? 'positive' : null,
            bounced,
          },
        })

        await db.draftEmail.update({ where: { id: draft.id }, data: { status: 'sent' } })
        await db.prospect.update({ where: { id: draft.prospectId }, data: { status: 'contacted' } })
        results.push({ draftId: draft.id, sentEmailId: sentEmail.id, recipient: recipientEmail })
      } catch (err) {
        errors.push({ draftId: draft.id, error: String(err) })
      }
    }

    return NextResponse.json({
      sent: results.length,
      errors: errors.length,
      provider: engageEnabled ? 'engage' : isDemoMode ? 'demo' : 'sendgrid',
      results,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Send failed', details: String(error) }, { status: 500 })
  }
}
