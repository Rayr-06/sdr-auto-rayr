import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeSentiment } from '@/lib/llm';

interface RouteParams {
  params: Promise<{ trackingId: string }>;
}

/**
 * GET /api/stage5/track/[trackingId]
 * Records an email open event. This endpoint is designed to be called
 * when a tracking pixel in an email is loaded.
 * - Sets openedAt to current time (if not already set)
 * - Increments openCount by 1
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { trackingId } = await params;

    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId is required' }, { status: 400 });
    }

    // Find the sent email by tracking ID
    const sentEmail = await db.sentEmail.findUnique({
      where: { trackingId },
    });

    if (!sentEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Update the email record: set openedAt if first open, increment openCount
    const updatedEmail = await db.sentEmail.update({
      where: { trackingId },
      data: {
        openedAt: sentEmail.openedAt || new Date(),
        openCount: sentEmail.openCount + 1,
      },
    });

    return NextResponse.json({
      success: true,
      trackingId,
      openedAt: updatedEmail.openedAt,
      openCount: updatedEmail.openCount,
    });
  } catch (error) {
    console.error('Email tracking failed:', error);
    return NextResponse.json(
      { error: 'Email tracking failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stage5/track/[trackingId]
 * Records an email reply. Uses LLM-powered sentiment analysis
 * to classify the reply and suggest next actions.
 *
 * Body: { replyText: string }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { trackingId } = await params;

    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId is required' }, { status: 400 });
    }

    const body = await request.json();
    const { replyText } = body as { replyText?: string };

    if (!replyText || replyText.trim().length === 0) {
      return NextResponse.json({ error: 'replyText is required' }, { status: 400 });
    }

    // Find the sent email by tracking ID
    const sentEmail = await db.sentEmail.findUnique({
      where: { trackingId },
    });

    if (!sentEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Use LLM-powered sentiment analysis to classify the reply
    const sentimentResult = await analyzeSentiment(replyText);

    // Update the sent email record with reply info
    const updatedEmail = await db.sentEmail.update({
      where: { trackingId },
      data: {
        repliedAt: new Date(),
        replyText,
        replySentiment: sentimentResult.sentiment,
      },
    });

    return NextResponse.json({
      success: true,
      trackingId,
      repliedAt: updatedEmail.repliedAt,
      replySentiment: sentimentResult.sentiment,
      sentimentAnalysis: {
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        intent: sentimentResult.intent,
        suggestedAction: sentimentResult.suggestedAction,
        keyPhrases: sentimentResult.keyPhrases,
      },
    });
  } catch (error) {
    console.error('Reply tracking failed:', error);
    return NextResponse.json(
      { error: 'Reply tracking failed', details: String(error) },
      { status: 500 }
    );
  }
}
