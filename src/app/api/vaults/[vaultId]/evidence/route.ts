import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  getUploadUrl, 
  uploadFileToS3, 
  getObjectText, 
  classifyEvidence,
  getContentType,
  listVaultObjects,
  getObjectStatus,
  triggerIngestion
} from '@/lib/case-api';
import { 
  addEvidence, 
  getAllEvidence, 
  filterEvidence,
  getAllTags,
  getCategoryCounts,
  updateEvidence
} from '@/lib/evidence-store';
import { EvidenceItem, FilterState } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Check if we need to sync with vault
    const sync = searchParams.get('sync') === 'true';
    
    if (sync) {
      // Sync evidence from vault objects
      await syncEvidenceFromVault(vaultId);
    }
    
    // Parse filter parameters
    const filters: FilterState = {
      categories: searchParams.get('categories')?.split(',').filter(Boolean) as FilterState['categories'] || [],
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      dateRange: {
        start: searchParams.get('dateStart') || undefined,
        end: searchParams.get('dateEnd') || undefined,
      },
      searchQuery: searchParams.get('q') || '',
      sortBy: (searchParams.get('sortBy') as FilterState['sortBy']) || 'date',
      sortOrder: (searchParams.get('sortOrder') as FilterState['sortOrder']) || 'desc',
    };

    const evidence = filterEvidence(vaultId, filters);
    const allTags = getAllTags(vaultId);
    const categoryCounts = getCategoryCounts(vaultId);

    return NextResponse.json({
      evidence,
      tags: allTags,
      categoryCounts,
      total: evidence.length,
    });
  } catch (error) {
    console.error('Failed to get evidence:', error);
    return NextResponse.json(
      { error: 'Failed to get evidence' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const results: Array<{ filename: string; status: string; evidenceId?: string; objectId?: string; error?: string }> = [];

    for (const file of files) {
      try {
        const contentType = file.type || getContentType(file.name);
        
        // Get upload URL
        const uploadResponse = await getUploadUrl(vaultId, file.name, contentType);
        console.log(`[Upload] Got upload URL for ${file.name}, objectId: ${uploadResponse.objectId}`);
        
        // Upload file to S3
        const arrayBuffer = await file.arrayBuffer();
        await uploadFileToS3(uploadResponse.uploadUrl, arrayBuffer, contentType);
        console.log(`[Upload] Uploaded ${file.name} to S3`);

        // Trigger ingestion explicitly (auto_index may not work reliably)
        try {
          await triggerIngestion(vaultId, uploadResponse.objectId);
          console.log(`[Upload] Triggered ingestion for ${file.name}`);
        } catch (ingestError) {
          console.error(`[Upload] Failed to trigger ingestion for ${file.name}:`, ingestError);
          // Continue anyway - ingestion might already be triggered
        }

        // Create initial evidence item - use objectId as id for consistency
        const evidence: EvidenceItem = {
          id: uploadResponse.objectId, // Use objectId as id for consistency
          objectId: uploadResponse.objectId,
          filename: file.name,
          contentType,
          sizeBytes: file.size,
          category: 'other',
          tags: [],
          relevanceScore: 0,
          ingestionStatus: 'processing',
          createdAt: new Date().toISOString(),
        };

        addEvidence(vaultId, evidence);

        results.push({
          filename: file.name,
          status: 'uploaded',
          evidenceId: uploadResponse.objectId, // Use objectId as evidenceId
          objectId: uploadResponse.objectId,
        });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        results.push({
          filename: file.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Failed to upload evidence:', error);
    return NextResponse.json(
      { error: 'Failed to upload evidence' },
      { status: 500 }
    );
  }
}

// Helper function to sync evidence from vault objects
async function syncEvidenceFromVault(vaultId: string): Promise<void> {
  try {
    const { objects } = await listVaultObjects(vaultId);
    const existingEvidence = getAllEvidence(vaultId);
    
    // Create a map of existing evidence by objectId for quick lookup
    const existingByObjectId = new Map<string, EvidenceItem>();
    existingEvidence.forEach(e => {
      if (e.objectId) {
        existingByObjectId.set(e.objectId, e);
      }
      // Also map by id in case id === objectId
      existingByObjectId.set(e.id, e);
    });

    for (const obj of objects) {
      const existing = existingByObjectId.get(obj.id);
      
      if (!existing) {
        // New object, create evidence item with default category
        // Use objectId as the id for consistency across reloads
        const evidence: EvidenceItem = {
          id: obj.id, // Use objectId as id for consistency
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
        console.log(`Added new evidence from vault: ${obj.filename} (${obj.id})`);
      } else {
        // Update ingestion status if it changed - but DON'T overwrite 'completed' status
        // This is important for images where vault shows 'extraction_failed' but we've already classified them
        if (existing.ingestionStatus !== obj.ingestionStatus && existing.ingestionStatus !== 'completed') {
          updateEvidence(vaultId, existing.id, {
            ingestionStatus: obj.ingestionStatus as EvidenceItem['ingestionStatus'],
          });
          console.log(`Updated ingestion status for ${obj.filename}: ${existing.ingestionStatus} -> ${obj.ingestionStatus}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to sync evidence from vault:', error);
  }
}
