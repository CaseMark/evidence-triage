import { NextRequest, NextResponse } from 'next/server';
import { deleteVaultObject, listVaultObjects, getObjectStatus, isImageFile } from '@/lib/case-api';
import { getEvidence, deleteEvidence, getAllEvidence, addEvidence } from '@/lib/evidence-store';
import { EvidenceItem } from '@/lib/types';

// Helper function to sync evidence from vault (ensures in-memory store is populated)
async function ensureEvidenceSynced(vaultId: string): Promise<void> {
  try {
    const existingEvidence = getAllEvidence(vaultId);
    
    // If we already have evidence in memory, skip sync
    if (existingEvidence.length > 0) {
      return;
    }
    
    // Sync from vault
    const { objects } = await listVaultObjects(vaultId);
    
    for (const obj of objects) {
      const evidence: EvidenceItem = {
        id: obj.id,
        objectId: obj.id,
        filename: obj.filename,
        contentType: obj.contentType,
        sizeBytes: obj.sizeBytes,
        category: 'other',
        tags: [],
        relevanceScore: 0,
        ingestionStatus: obj.ingestionStatus as EvidenceItem['ingestionStatus'],
        createdAt: obj.createdAt,
      };
      addEvidence(vaultId, evidence);
    }
  } catch (error) {
    console.error('Failed to sync evidence from vault:', error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    
    console.log(`DELETE request for vaultId: ${vaultId}, evidenceId: ${evidenceId}`);
    
    // Ensure evidence is synced from vault (handles server restart case)
    await ensureEvidenceSynced(vaultId);
    
    // Get evidence item - first try by ID
    let evidence = getEvidence(vaultId, evidenceId);
    console.log(`Found by getEvidence: ${evidence ? 'yes' : 'no'}`);
    
    // If not found, try to find by objectId (evidenceId might be the objectId)
    if (!evidence) {
      const allEvidence = getAllEvidence(vaultId);
      console.log(`Total evidence in store: ${allEvidence.length}`);
      evidence = allEvidence.find(e => e.objectId === evidenceId || e.id === evidenceId);
      console.log(`Found by searching all: ${evidence ? 'yes' : 'no'}`);
    }
    
    if (!evidence) {
      console.log('Evidence not found in local store');
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    console.log(`Deleting evidence: id=${evidence.id}, objectId=${evidence.objectId}`);

    // Delete from Case.dev vault
    let vaultDeleteSuccess = false;
    try {
      await deleteVaultObject(vaultId, evidence.objectId);
      vaultDeleteSuccess = true;
      console.log('Successfully deleted from Case.dev vault');
    } catch (error) {
      // Log the error but continue - the object might already be deleted or the API might not support delete
      console.error('Failed to delete from vault (continuing anyway):', error);
    }

    // Delete from local store
    const deleted = deleteEvidence(vaultId, evidence.id);
    console.log(`Deleted from local store: ${deleted}`);

    if (!deleted) {
      // Even if local delete fails, if vault delete succeeded, consider it a success
      if (vaultDeleteSuccess) {
        return NextResponse.json({
          success: true,
          message: 'Evidence deleted from vault (local store cleanup pending)',
          evidenceId: evidence.id,
          objectId: evidence.objectId,
        });
      }
      return NextResponse.json(
        { error: 'Failed to delete evidence from local store' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Evidence deleted successfully',
      evidenceId: evidence.id,
      objectId: evidence.objectId,
    });
  } catch (error) {
    console.error('Failed to delete evidence:', error);
    return NextResponse.json(
      { error: 'Failed to delete evidence' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    
    // Get evidence item
    let evidence = getEvidence(vaultId, evidenceId);
    
    // If not found, try to find by objectId
    if (!evidence) {
      const allEvidence = getAllEvidence(vaultId);
      evidence = allEvidence.find(e => e.objectId === evidenceId || e.id === evidenceId);
    }
    
    if (!evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // For images, get the download URL
    let downloadUrl: string | undefined;
    if (isImageFile(evidence.contentType)) {
      try {
        const status = await getObjectStatus(vaultId, evidence.objectId);
        downloadUrl = status.downloadUrl;
      } catch (error) {
        console.error('Failed to get download URL:', error);
      }
    }

    return NextResponse.json({ 
      evidence,
      downloadUrl,
    });
  } catch (error) {
    console.error('Failed to get evidence:', error);
    return NextResponse.json(
      { error: 'Failed to get evidence' },
      { status: 500 }
    );
  }
}
