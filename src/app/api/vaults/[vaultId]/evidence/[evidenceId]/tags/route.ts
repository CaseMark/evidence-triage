import { NextRequest, NextResponse } from 'next/server';
import { getEvidence, updateEvidence } from '@/lib/evidence-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    const body = await request.json();
    const { tags } = body;

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array' },
        { status: 400 }
      );
    }

    const evidence = getEvidence(vaultId, evidenceId);
    if (!evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    const updated = updateEvidence(vaultId, evidenceId, { tags });

    return NextResponse.json({ evidence: updated });
  } catch (error) {
    console.error('Failed to update tags:', error);
    return NextResponse.json(
      { error: 'Failed to update tags' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    const body = await request.json();
    const { tag } = body;

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json(
        { error: 'Tag must be a string' },
        { status: 400 }
      );
    }

    const evidence = getEvidence(vaultId, evidenceId);
    if (!evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Add tag if not already present
    const newTags = evidence.tags.includes(tag) 
      ? evidence.tags 
      : [...evidence.tags, tag];

    const updated = updateEvidence(vaultId, evidenceId, { tags: newTags });

    return NextResponse.json({ evidence: updated });
  } catch (error) {
    console.error('Failed to add tag:', error);
    return NextResponse.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag parameter is required' },
        { status: 400 }
      );
    }

    const evidence = getEvidence(vaultId, evidenceId);
    if (!evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    const newTags = evidence.tags.filter(t => t !== tag);
    const updated = updateEvidence(vaultId, evidenceId, { tags: newTags });

    return NextResponse.json({ evidence: updated });
  } catch (error) {
    console.error('Failed to remove tag:', error);
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
