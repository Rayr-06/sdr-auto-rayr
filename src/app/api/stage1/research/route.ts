import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { callLLM, parseJSONResponse } from '@/lib/llm'
import { searchZoomInfoContacts, isZoomInfoConfigured } from '@/lib/zoominfo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      industries = ['SaaS'], companySizeMin = 50, companySizeMax = 2000,
      targetTitles = ['VP Sales'], seniority = ['VP'], geographies = ['US'],
      techSignals = [], painKeywords = [],
    } = body

    // ── LLM: ICP Analysis ──────────────────────────────────
    const llmRes = await callLLM(
      'You are a B2B market research analyst. Respond with valid JSON only.',
      `Create an Ideal Customer Profile for:
Industries: ${industries.join(', ')} | Size: ${companySizeMin}-${companySizeMax} | Titles: ${targetTitles.join(', ')} | Pain: ${painKeywords.join(', ')}
Return JSON: { name, summary, painPoints: string[], buyingSignals: string[], competitors: string[], sampleCompanies: string[] }`
    )
    const icpData = parseJSONResponse<Record<string, unknown>>(llmRes, {})
    const icpName = (icpData.name as string) || `${industries[0]} ICP`

    const icp = await db.iCP.create({
      data: {
        name: icpName,
        version: 1,
        config: JSON.stringify({ industries, companySizeMin, companySizeMax, targetTitles, seniority, geographies, techSignals, painKeywords, ...icpData }),
        active: true,
      },
    })

    // ── Prospects: ZoomInfo if configured, else LLM demo ──
    let prospectCount = 0

    if (isZoomInfoConfigured()) {
      // REAL DATA from ZoomInfo
      const contacts = await searchZoomInfoContacts({
        industries, titles: targetTitles,
        companySizeMin, companySizeMax,
        geographies, techStack: techSignals, limit: 25,
      })

      for (const c of contacts) {
        const icpScore = 70 + Math.random() * 25
        await db.prospect.create({
          data: {
            icpId: icp.id,
            contact: JSON.stringify({
              full_name: `${c.firstName} ${c.lastName}`,
              email: c.email,
              title: c.jobTitle,
              linkedin: c.linkedInUrl,
              phone: c.phone,
            }),
            company: JSON.stringify({
              name: c.company?.name,
              domain: c.company?.website,
              size: String(c.company?.employeeCount || ''),
              industry: c.company?.industry,
              revenue: c.company?.revenue,
              location: `${c.company?.city}, ${c.company?.country}`,
              tech_stack: c.company?.techStack || [],
              funding: c.company?.fundingTotal,
            }),
            icpScore: Math.round(icpScore * 10) / 10,
            intentScore: 0,
            status: icpScore >= 80 ? 'hot' : icpScore >= 65 ? 'warm' : 'cold',
            enrichedAt: new Date(),
          },
        })
        prospectCount++
      }
    } else {
      // DEMO DATA from LLM
      const { generateProspectProfiles } = await import('@/lib/llm')
      const profiles = await generateProspectProfiles({ industries, companySizeMin, companySizeMax, targetTitles, seniority, geographies, techSignals, painKeywords })

      for (const p of profiles) {
        await db.prospect.create({
          data: {
            icpId: icp.id,
            contact: JSON.stringify({ full_name: p.full_name, email: p.email, title: p.title, linkedin: p.linkedin }),
            company: JSON.stringify(p.company),
            icpScore: Math.round(p.icpScore * 10) / 10,
            intentScore: 0,
            status: p.icpScore >= 80 ? 'hot' : p.icpScore >= 60 ? 'warm' : 'cold',
            enrichedAt: new Date(),
          },
        })
        prospectCount++
      }
    }

    return NextResponse.json({
      icp: { id: icp.id, name: icp.name },
      prospectCount,
      dataSource: isZoomInfoConfigured() ? 'zoominfo' : 'ai-demo',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Research failed', details: String(error) }, { status: 500 })
  }
}
