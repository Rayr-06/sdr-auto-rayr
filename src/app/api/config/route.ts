import { NextResponse } from 'next/server'
import { isZoomInfoConfigured } from '@/lib/zoominfo'
import { isEngageConfigured } from '@/lib/engage'

export async function GET() {
  const groq = !!process.env.GROQ_API_KEY
  const anthropic = !!process.env.ANTHROPIC_API_KEY
  const openai = !!process.env.OPENAI_API_KEY
  const zoominfo = isZoomInfoConfigured()
  const engage = isEngageConfigured()
  const sendgrid = !!process.env.SENDGRID_API_KEY

  const provider = groq ? 'groq' : anthropic ? 'anthropic' : openai ? 'openai' : 'demo'
  const model = groq ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile')
    : anthropic ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514')
    : openai ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : 'demo'

  return NextResponse.json({
    provider,
    model,
    configured: groq || anthropic || openai,
    integrations: {
      zoominfo: { enabled: zoominfo, label: zoominfo ? 'ZoomInfo Connected ✓' : 'Not connected' },
      engage: { enabled: engage, label: engage ? 'Engage Connected ✓' : 'Not connected' },
      sendgrid: { enabled: sendgrid, label: sendgrid ? 'SendGrid Connected ✓' : 'Not connected' },
    },
    dataSource: zoominfo ? 'ZoomInfo (Real Data)' : 'AI Demo Data',
  })
}
