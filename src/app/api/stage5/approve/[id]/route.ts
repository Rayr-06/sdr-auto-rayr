import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, selectedSubject, editedSubject, editedBody } = body;

    if (!['approve', 'edit', 'skip'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, edit, or skip' },
        { status: 400 }
      );
    }

    const draft = await db.draftEmail.findUnique({ where: { id } });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status !== 'pending') {
      return NextResponse.json(
        { error: `Draft is already ${draft.status}` },
        { status: 400 }
      );
    }

    if (action === 'skip') {
      const updated = await db.draftEmail.update({
        where: { id },
        data: { status: 'skipped' },
      });

      return NextResponse.json({
        draft: {
          ...updated,
          subjectLines: JSON.parse(updated.subjectLines),
          personalisationTokens: JSON.parse(updated.personalisationTokens),
          generationMetadata: JSON.parse(updated.generationMetadata),
        },
        action: 'skipped',
      });
    }

    if (action === 'edit') {
      if (!editedSubject && !editedBody) {
        return NextResponse.json(
          { error: 'editedSubject or editedBody is required for edit action' },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = {
        status: 'approved',
        approvedBy: 'user',
        approvedAt: new Date(),
      };

      if (editedSubject) updateData.editedSubject = editedSubject;
      if (editedBody) updateData.editedBody = editedBody;
      if (selectedSubject !== undefined) updateData.selectedSubject = selectedSubject;

      const updated = await db.draftEmail.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        draft: {
          ...updated,
          subjectLines: JSON.parse(updated.subjectLines),
          personalisationTokens: JSON.parse(updated.personalisationTokens),
          generationMetadata: JSON.parse(updated.generationMetadata),
        },
        action: 'edited_and_approved',
      });
    }

    // action === 'approve'
    const updateData: Record<string, unknown> = {
      status: 'approved',
      approvedBy: 'user',
      approvedAt: new Date(),
    };

    if (selectedSubject !== undefined) {
      updateData.selectedSubject = selectedSubject;
    }

    const updated = await db.draftEmail.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      draft: {
        ...updated,
        subjectLines: JSON.parse(updated.subjectLines),
        personalisationTokens: JSON.parse(updated.personalisationTokens),
        generationMetadata: JSON.parse(updated.generationMetadata),
      },
      action: 'approved',
    });
  } catch (error) {
    console.error('Approve action failed:', error);
    return NextResponse.json(
      { error: 'Failed to process approval', details: String(error) },
      { status: 500 }
    );
  }
}
