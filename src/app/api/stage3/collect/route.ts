import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyzeSignals } from '@/lib/llm'
import { getZoomInfoIntentSignals, isZoomInfoConfigured } from '@/lib/zoominfo'

export async function POST() {
  try {
    const prospects = await db.prospect.findMany({
      where: { signals: { none: {} } },
      take: 50,
    })

    if (!prospects.length) {
      return NextResponse.json({ message: 'No prospects need signals', totalSignals: 0, prospectsProcessed: 0 })
    }

    let totalSignals = 0
    const ziConfigured = isZoomInfoConfigured()

    // If ZoomInfo configured, pull real intent signals
    if (ziConfigured) {
      const icpIds = [...new Set(prospects.map(p => p.icpId))]
      for (const icpId of icpIds) {
        const icp = await db.iCP.findUnique({ where: { id: icpId } })
        if (!icp) continue
        const config = JSON.parse(icp.config) as Record<string, unknown>

        const intentSignals = await getZoomInfoIntentSignals({
          topics: (config.painKeywords as string[]) || ['outbound sales', 'CRM', 'pipeline'],
          companySizeMin: (config.companySizeMin as number) || 50,
          companySizeMax: (config.companySizeMax as number) || 2000,
          industries: (config.industries as string[]) || ['SaaS'],
        })

        // Match intent signals to prospects by company
        for (const sig of intentSignals) {
          const matchingProspect = prospects.find(p => {
            const company = JSON.parse(p.company) as Record<string, unknown>
            return String(company.name || '').toLowerCase().includes(sig.companyName.toLowerCase())
          })

          if (matchingProspect) {
            await db.signal.create({
              data: {
                prospectId: matchingProspect.id,
                signalType: 'intent',
                source: 'zoominfo',
                weight: sig.score / 100,
                humanSummary: `ZoomInfo Intent: ${sig.companyName} is actively researching "${sig.topic}" (score: ${sig.score})`,
                rawData: JSON.stringify(sig),
                detectedAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
            totalSignals++
          }
        }
      }
    }

    // Always also run LLM signal analysis for all prospects
    for (const prospect of prospects) {
      const contact = JSON.parse(prospect.contact) as Record<string, string>
      const company = JSON.parse(prospect.company) as Record<string, string>
      const signals = await analyzeSignals(contact as { full_name: string; title: string }, company as { name: string; domain: string; size: string; industry: string; revenue: string })

      for (const s of signals) {
        await db.signal.create({
          data: {
            prospectId: prospect.id,
            signalType: s.signalType,
            source: ziConfigured ? `${s.source}+zoominfo` : s.source,
            weight: s.weight,
            humanSummary: s.humanSummary,
            rawData: JSON.stringify(s.rawData || {}),
            detectedAt: new Date(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        })
        totalSignals++
      }

      const allSignals = await db.signal.findMany({ where: { prospectId: prospect.id } })
      const avgWeight = allSignals.reduce((sum, s) => sum + s.weight, 0) / Math.max(allSignals.length, 1)
      await db.prospect.update({
        where: { id: prospect.id },
        data: { intentScore: Math.min(100, Math.round(avgWeight * 100)) },
      })
    }

    return NextResponse.json({
      totalSignals,
      prospectsProcessed: prospects.length,
      dataSource: ziConfigured ? 'zoominfo+ai' : 'ai-demo',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Signal collection failed', details: String(error) }, { status: 500 })
  }
}
