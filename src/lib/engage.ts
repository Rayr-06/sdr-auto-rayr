// ZoomInfo Engage (Salesloft) API Integration  
// Add ENGAGE_API_KEY to your env

interface EngageCadence {
  id: number
  name: string
  stepCount: number
}

interface EngageProspect {
  id: number
  email: string
  firstName: string
  lastName: string
  title: string
  company: string
  enrolled: boolean
  cadenceId?: number
}

interface EngageEmailResult {
  id: number
  prospectId: number
  subject: string
  sentAt: string
  openedAt?: string
  repliedAt?: string
  bouncedAt?: string
  clickedAt?: string
}

function engageHeaders() {
  const apiKey = process.env.ENGAGE_API_KEY
  if (!apiKey) throw new Error('Engage API key not configured')
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export async function getEngageCadences(): Promise<EngageCadence[]> {
  const res = await fetch('https://api.engage.zoominfo.com/v1/cadences', {
    headers: engageHeaders(),
  })
  if (!res.ok) throw new Error(`Engage cadences failed: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export async function createEngageProspect(contact: {
  email: string
  firstName: string
  lastName: string
  title: string
  company: string
  phone?: string
  linkedIn?: string
}): Promise<EngageProspect> {
  const res = await fetch('https://api.engage.zoominfo.com/v1/prospects', {
    method: 'POST',
    headers: engageHeaders(),
    body: JSON.stringify({
      email: contact.email,
      first_name: contact.firstName,
      last_name: contact.lastName,
      title: contact.title,
      company: contact.company,
      phone: contact.phone,
      linkedin_url: contact.linkedIn,
    }),
  })
  if (!res.ok) throw new Error(`Create prospect failed: ${res.status}`)
  const data = await res.json()
  return data.data
}

export async function enrollInCadence(params: {
  prospectId: number
  cadenceId: number
  mailboxEmail: string
}): Promise<{ success: boolean; enrollmentId: number }> {
  const res = await fetch('https://api.engage.zoominfo.com/v1/cadence-memberships', {
    method: 'POST',
    headers: engageHeaders(),
    body: JSON.stringify({
      prospect_id: params.prospectId,
      cadence_id: params.cadenceId,
      mailbox_email: params.mailboxEmail,
    }),
  })
  if (!res.ok) throw new Error(`Enroll in cadence failed: ${res.status}`)
  const data = await res.json()
  return { success: true, enrollmentId: data.data?.id }
}

export async function sendEngageEmail(params: {
  prospectId: number
  subject: string
  body: string
  mailboxEmail: string
  scheduleAt?: string
}): Promise<{ success: boolean; emailId: number }> {
  const res = await fetch('https://api.engage.zoominfo.com/v1/emails', {
    method: 'POST',
    headers: engageHeaders(),
    body: JSON.stringify({
      prospect_id: params.prospectId,
      subject: params.subject,
      body: params.body,
      mailbox_email: params.mailboxEmail,
      schedule_at: params.scheduleAt || null,
    }),
  })
  if (!res.ok) throw new Error(`Send email failed: ${res.status}`)
  const data = await res.json()
  return { success: true, emailId: data.data?.id }
}

export async function getEngageEmailStats(emailIds: number[]): Promise<EngageEmailResult[]> {
  const params = emailIds.map(id => `ids[]=${id}`).join('&')
  const res = await fetch(`https://api.engage.zoominfo.com/v1/emails?${params}`, {
    headers: engageHeaders(),
  })
  if (!res.ok) throw new Error(`Get email stats failed: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export async function getEngageProspectActivity(prospectId: number) {
  const res = await fetch(`https://api.engage.zoominfo.com/v1/prospects/${prospectId}/activities`, {
    headers: engageHeaders(),
  })
  if (!res.ok) throw new Error(`Get activity failed: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export function isEngageConfigured(): boolean {
  return !!process.env.ENGAGE_API_KEY
}
