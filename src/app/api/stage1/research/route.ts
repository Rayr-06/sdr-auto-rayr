import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callLLM, parseJSONResponse, generateProspectProfiles } from '@/lib/llm';
import type { ICPConfig } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      industries = ['SaaS', 'FinTech'],
      companySizeMin = 50,
      companySizeMax = 1000,
      targetTitles = ['VP Sales', 'CRO', 'Head of Growth'],
      seniority = ['VP', 'C-Suite', 'Director'],
      geographies = ['US', 'UK'],
      techSignals = ['Salesforce', 'HubSpot'],
      painKeywords = ['outbound', 'pipeline', 'conversion'],
    } = body;

    const config: ICPConfig = {
      industries,
      companySizeMin,
      companySizeMax,
      targetTitles,
      seniority,
      geographies,
      techSignals,
      painKeywords,
    };

    // === Step 1: Generate ICP using LLM ===
    const llmResponse = await callLLM(
      'You are a market research analyst specializing in B2B sales. You analyze markets and create Ideal Customer Profiles. Always respond with valid JSON only.',
      `Analyze the following target market and generate an Ideal Customer Profile (ICP). Return a JSON object with:
- name: A descriptive name for this ICP
- summary: 2-3 sentence summary of the ideal customer
- painPoints: Array of 5 key pain points
- buyingSignals: Array of 5 buying signals to look for
- competitors: Array of 3-5 competitors in this space
- sampleCompanies: Array of 5 sample company names that fit this profile

Target criteria:
- Industries: ${industries.join(', ')}
- Company size: ${companySizeMin}-${companySizeMax} employees
- Target titles: ${targetTitles.join(', ')}
- Seniority levels: ${seniority.join(', ')}
- Geographies: ${geographies.join(', ')}
- Tech signals: ${techSignals.join(', ')}
- Pain keywords: ${painKeywords.join(', ')}`
    );

    const llmResult = parseJSONResponse<Record<string, unknown>>(llmResponse, {});

    const icpName = (llmResult.name as string) || `${industries[0]} ${companySizeMin}-${companySizeMax} Employee ICP`;

    // Create ICP in database
    const icp = await db.iCP.create({
      data: {
        name: icpName,
        version: 1,
        config: JSON.stringify({ ...config, ...llmResult }),
        active: true,
      },
    });

    // === Step 2: Generate prospect profiles using LLM ===
    // Use the enhanced generateProspectProfiles function which makes
    // a single batched LLM call for all prospects instead of one-by-one
    const profiles = await generateProspectProfiles(config);

    const prospectIds: string[] = [];

    for (const profile of profiles) {
      const icpScore = Math.round(profile.icpScore * 10) / 10;

      const prospect = await db.prospect.create({
        data: {
          icpId: icp.id,
          contact: JSON.stringify({
            full_name: profile.full_name,
            email: profile.email,
            title: profile.title,
            linkedin: profile.linkedin,
          }),
          company: JSON.stringify(profile.company),
          icpScore,
          intentScore: 0,
          status: icpScore >= 80 ? 'hot' : icpScore >= 60 ? 'warm' : 'cold',
          enrichedAt: new Date(),
        },
      });

      prospectIds.push(prospect.id);
    }

    return NextResponse.json({
      icp: {
        ...icp,
        config: JSON.parse(icp.config),
      },
      prospectIds,
      prospectCount: prospectIds.length,
      llmUsed: llmResult.name !== undefined, // Track whether LLM was actually used
    });
  } catch (error) {
    console.error('Research failed:', error);
    return NextResponse.json(
      { error: 'Research stage failed', details: String(error) },
      { status: 500 }
    );
  }
}
