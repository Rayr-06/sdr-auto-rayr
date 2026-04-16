import { NextResponse } from 'next/server';
import { getActiveLLMInfo } from '@/lib/llm';

export async function GET() {
  return NextResponse.json(getActiveLLMInfo());
}
