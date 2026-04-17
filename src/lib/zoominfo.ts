// ZoomInfo API Integration
// Add ZOOMINFO_CLIENT_ID and ZOOMINFO_CLIENT_SECRET to your env

interface ZoomInfoContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  linkedInUrl: string
  company: {
    id: string
    name: string
    website: string
    revenue: string
    employeeCount: number
    industry: string
    city: string
    state: string
    country: string
    techStack: string[]
    fundingTotal: string
  }
}

interface ZoomInfoIntentSignal {
  companyId: string
  companyName: string
  topic: string
  score: number
  date: string
}

let ziToken: string | null = null
let ziTokenExpiry: number = 0

async function getZoomInfoToken(): Promise<string> {
  if (ziToken && Date.now() < ziTokenExpiry) return ziToken

  const clientId = process.env.ZOOMINFO_CLIENT_ID
  const clientSecret = process.env.ZOOMINFO_CLIENT_SECRET

  if (!clientId || !clientSecret) throw new Error('ZoomInfo credentials not configured')

  const res = await fetch('https://api.zoominfo.com/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: clientId, password: clientSecret }),
  })

  if (!res.ok) throw new Error(`ZoomInfo auth failed: ${res.status}`)
  const data = await res.json()
  ziToken = data.jwt
  ziTokenExpiry = Date.now() + 55 * 60 * 1000 // 55 min
  return ziToken!
}

export async function searchZoomInfoContacts(params: {
  industries: string[]
  titles: string[]
  companySizeMin: number
  companySizeMax: number
  geographies: string[]
  techStack?: string[]
  limit?: number
}): Promise<ZoomInfoContact[]> {
  const token = await getZoomInfoToken()

  const body = {
    outputFields: [
      'id', 'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'linkedInUrl',
      'company.id', 'company.name', 'company.website', 'company.revenue',
      'company.employeeCount', 'company.industry', 'company.city',
      'company.state', 'company.country', 'company.techStack', 'company.fundingTotal'
    ],
    matchPersonInput: [
      {
        jobTitle: params.titles,
        personHasManagedFilter: 'true',
      }
    ],
    matchCompanyInput: [
      {
        industries: params.industries,
        employeeCountRangeLower: params.companySizeMin,
        employeeCountRangeUpper: params.companySizeMax,
        countries: params.geographies,
        techStack: params.techStack || [],
      }
    ],
    rpp: params.limit || 25,
    page: 1,
  }

  const res = await fetch('https://api.zoominfo.com/search/contact', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`ZoomInfo search failed: ${res.status}`)
  const data = await res.json()
  return data.data?.result || []
}

export async function getZoomInfoIntentSignals(params: {
  topics: string[]
  companySizeMin: number
  companySizeMax: number
  industries: string[]
}): Promise<ZoomInfoIntentSignal[]> {
  const token = await getZoomInfoToken()

  const body = {
    intentTopics: params.topics,
    matchCompanyInput: [{
      industries: params.industries,
      employeeCountRangeLower: params.companySizeMin,
      employeeCountRangeUpper: params.companySizeMax,
    }],
    rpp: 50,
    page: 1,
  }

  const res = await fetch('https://api.zoominfo.com/search/intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`ZoomInfo intent failed: ${res.status}`)
  const data = await res.json()
  return data.data?.result || []
}

export async function enrichZoomInfoContact(email: string): Promise<ZoomInfoContact | null> {
  const token = await getZoomInfoToken()

  const res = await fetch('https://api.zoominfo.com/search/contact', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      matchPersonInput: [{ emailAddress: email }],
      outputFields: ['id', 'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'linkedInUrl', 'company.name', 'company.industry', 'company.employeeCount'],
      rpp: 1,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return data.data?.result?.[0] || null
}

export function isZoomInfoConfigured(): boolean {
  return !!(process.env.ZOOMINFO_CLIENT_ID && process.env.ZOOMINFO_CLIENT_SECRET)
}
