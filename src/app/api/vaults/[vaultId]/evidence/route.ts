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
    
    // Debug: Log first object to see structure
    if (objects.length > 0) {
      console.log('[Sync] First vault object structure:', JSON.stringify(objects[0], null, 2));
    }
    
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
      
      // Extract classification from vault metadata (prefixed with et_)
      // Note: metadata may be at top level OR nested in a metadata object depending on API response
      // extracted text is NOT stored in metadata - fetched on-demand via /objects/{id}/text
      const meta = obj.metadata || obj; // Try nested metadata first, fallback to top-level
      const etCategory = (meta as Record<string, unknown>).et_category || obj.et_category;
      const hasClassification = !!etCategory;
      
      const classificationData = hasClassification ? {
        category: (etCategory as EvidenceItem['category']) || 'other',
        tags: ((meta as Record<string, unknown>).et_tags || obj.et_tags) ? JSON.parse(String((meta as Record<string, unknown>).et_tags || obj.et_tags)) : [],
        summary: ((meta as Record<string, unknown>).et_summary || obj.et_summary || undefined) as string | undefined,
        dateDetected: ((meta as Record<string, unknown>).et_date_detected || obj.et_date_detected || undefined) as string | undefined,
        relevanceScore: Number((meta as Record<string, unknown>).et_relevance_score || obj.et_relevance_score || 0),
        ingestionStatus: 'completed' as const,
      } : null;
      
      if (!existing) {
        // New object, create evidence item
        // Use objectId as the id for consistency across reloads
        const evidence: EvidenceItem = {
          id: obj.id, // Use objectId as id for consistency
          objectId: obj.id,
          filename: obj.filename,
          contentType: obj.contentType,
          sizeBytes: obj.sizeBytes,
          category: classificationData?.category || 'other',
          tags: classificationData?.tags || [],
          summary: classificationData?.summary,
          dateDetected: classificationData?.dateDetected,
          relevanceScore: classificationData?.relevanceScore || 0,
          // extractedText is fetched on-demand when viewing document details
          ingestionStatus: classificationData ? 'completed' : (obj.ingestionStatus as EvidenceItem['ingestionStatus']),
          createdAt: obj.createdAt,
        };
        addEvidence(vaultId, evidence);
        console.log(`Added evidence from vault: ${obj.filename} (${obj.id})${hasClassification ? ' with classification' : ''}`);
      } else {
        // Existing evidence - check if we should update from vault metadata
        // If vault has classification data and our local copy doesn't, use vault data
        const localHasClassification = existing.category !== 'other' || existing.tags.length > 0 || existing.summary;
        
        if (hasClassification && !localHasClassification) {
          updateEvidence(vaultId, existing.id, classificationData!);
          console.log(`Restored classification from vault metadata for ${obj.filename}`);
        } else if (existing.ingestionStatus !== obj.ingestionStatus && existing.ingestionStatus !== 'completed') {
          // Update ingestion status if it changed - but DON'T overwrite 'completed' status
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
