import { NextRequest, NextResponse } from 'next/server'

// Runtime settings storage (persists in process memory for the session)
// For production, these should be set as environment variables in Render
const runtimeSettings: Record<string, string> = {}

const INTEGRATION_KEYS = [
  'GROQ_API_KEY','ANTHROPIC_API_KEY','OPENAI_API_KEY',
  'APOLLO_API_KEY',
  'ZOOMINFO_CLIENT_ID','ZOOMINFO_CLIENT_SECRET',
  'ENGAGE_API_KEY','ENGAGE_MAILBOX_EMAIL',
  'HUNTER_API_KEY','LUSHA_API_KEY',
  'SENDGRID_API_KEY','SENDGRID_FROM_EMAIL','SENDGRID_FROM_NAME',
]

function getVal(key: string): string {
  return process.env[key] || runtimeSettings[key] || ''
}

function maskVal(key: string, val: string): string {
  if (!val) return ''
  const isSensitive = key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')
  return isSensitive ? val.slice(0,4) + '••••••••' : val
}

export async function GET() {
  const settings: Record<string, string> = {}
  for (const k of INTEGRATION_KEYS) {
    settings[k] = maskVal(k, getVal(k))
  }
  return NextResponse.json({
    settings,
    status: {
      ai: !!(getVal('GROQ_API_KEY') || getVal('ANTHROPIC_API_KEY') || getVal('OPENAI_API_KEY')),
      apollo: !!getVal('APOLLO_API_KEY'),
      zoominfo: !!(getVal('ZOOMINFO_CLIENT_ID') && getVal('ZOOMINFO_CLIENT_SECRET')),
      engage: !!getVal('ENGAGE_API_KEY'),
      hunter: !!getVal('HUNTER_API_KEY'),
      lusha: !!getVal('LUSHA_API_KEY'),
      sendgrid: !!getVal('SENDGRID_API_KEY'),
    },
    aiProvider: getVal('GROQ_API_KEY') ? 'groq'
      : getVal('ANTHROPIC_API_KEY') ? 'anthropic'
      : getVal('OPENAI_API_KEY') ? 'openai' : 'demo',
    dataSource: getVal('APOLLO_API_KEY') ? 'apollo'
      : (getVal('ZOOMINFO_CLIENT_ID') && getVal('ZOOMINFO_CLIENT_SECRET')) ? 'zoominfo'
      : getVal('HUNTER_API_KEY') ? 'hunter'
      : getVal('LUSHA_API_KEY') ? 'lusha' : 'demo',
    emailProvider: getVal('ENGAGE_API_KEY') ? 'engage'
      : getVal('SENDGRID_API_KEY') ? 'sendgrid' : 'demo',
  })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json() as Record<string, string>
  for (const [k, v] of Object.entries(body)) {
    if (v && typeof v === 'string' && !v.includes('••••') && INTEGRATION_KEYS.includes(k)) {
      runtimeSettings[k] = v
      process.env[k] = v // Set for current session
    }
  }
  return NextResponse.json({ success: true, message: 'Settings saved. Add these to Render environment variables for persistence across restarts.' })
}
