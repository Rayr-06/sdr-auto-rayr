import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callLLM, parseJSONResponse, DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { icpId, companyDomains = [] } = body;

    if (!icpId) {
      return NextResponse.json({ error: 'icpId is required' }, { status: 400 });
    }

    const icp = await db.iCP.findUnique({ where: { id: icpId } });
    if (!icp) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    const icpConfig = JSON.parse(icp.config);

    // Use provided domains or generate demo ones
    const domains = companyDomains.length > 0
      ? companyDomains
      : DEMO_COMPANIES.slice(0, 6).map((c) => c.domain);

    const results: Array<{ prospectId: string; domain: string; score: number; status: string }> = [];

    for (const domain of domains) {
      // Find matching demo company or create one
      const demoCompany = DEMO_COMPANIES.find((c) => c.domain === domain) || {
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        domain,
        size: '100-500',
        industry: icpConfig.industries?.[0] || 'Technology',
        revenue: '$10M',
      };

      // Try LLM enrichment
      const llmResponse = await callLLM(
        'You are a B2B prospect enrichment specialist. Generate realistic prospect data. Always respond with valid JSON only.',
        `Generate a detailed prospect profile for a company with domain: ${domain}
        Based on the ICP: ${JSON.stringify(icpConfig)}
        Return JSON with:
        - contact: { full_name, email, title, linkedin, phone }
        - company: { name, domain, size, industry, revenue, location, tech_stack }
        - icpScore: number 0-100 (how well they match the ICP)
        - intentScore: number 0-100 (likelihood of buying intent)
        - keySignals: array of 2-3 buying signals detected`
      );

      const llmData = parseJSONResponse<Record<string, unknown>>(llmResponse, {});
      
      const contactTemplate = DEMO_CONTACTS[domains.indexOf(domain) % DEMO_CONTACTS.length];
      const contact = llmData.contact
        ? llmData.contact as Record<string, string>
        : {
            ...contactTemplate,
            email: contactTemplate.email.replace('{domain}', domain),
          };

      const company = llmData.company
        ? llmData.company as Record<string, string>
        : demoCompany;

      const icpScore = (llmData.icpScore as number) || (50 + Math.random() * 45);
      const intentScore = (llmData.intentScore as number) || (20 + Math.random() * 60);
      const status = icpScore >= 80 ? 'hot' : icpScore >= 55 ? 'warm' : 'cold';

      const prospect = await db.prospect.create({
        data: {
          icpId,
          contact: JSON.stringify(contact),
          company: JSON.stringify(company),
          icpScore: Math.round(icpScore * 10) / 10,
          intentScore: Math.round(intentScore * 10) / 10,
          status,
          enrichedAt: new Date(),
        },
      });

      results.push({
        prospectId: prospect.id,
        domain,
        score: Math.round(icpScore * 10) / 10,
        status,
      });
    }

    return NextResponse.json({
      enriched: results.length,
      results,
      icpId,
    });
  } catch (error) {
    console.error('Enrichment failed:', error);
    return NextResponse.json(
      { error: 'Enrichment stage failed', details: String(error) },
      { status: 500 }
    );
  }
}
