import { NextRequest, NextResponse } from 'next/server';
import { getObjectText, classifyEvidence, getObjectStatus, listVaultObjects, triggerIngestion, isImageFile, processOCR, getOCRStatus, getOCRText } from '@/lib/case-api';
import { getEvidence, updateEvidence, addEvidence, getAllEvidence } from '@/lib/evidence-store';
import { EvidenceItem } from '@/lib/types';

// Helper to wait for OCR completion
async function waitForOCR(jobId: string, maxAttempts: number = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getOCRStatus(jobId);
    console.log(`[OCR] Status check ${i + 1}: ${status.status}`);
    
    if (status.status === 'completed') {
      try {
        const text = await getOCRText(jobId);
        return text;
      } catch (e) {
        console.error('[OCR] Failed to get text:', e);
        return null;
      }
    } else if (status.status === 'failed') {
      console.error('[OCR] Job failed');
      return null;
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.error('[OCR] Timeout waiting for completion');
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; evidenceId: string }> }
) {
  try {
    const { vaultId, evidenceId } = await params;
    
    console.log(`[Classify] Starting classification for evidenceId: ${evidenceId}`);
    
    // Get evidence item - first try by ID
    let evidence = getEvidence(vaultId, evidenceId);
    console.log(`[Classify] Found by getEvidence: ${evidence ? 'yes' : 'no'}`);
    
    // If not found, try to find by objectId (evidenceId might be the objectId)
    if (!evidence) {
      const allEvidence = getAllEvidence(vaultId);
      console.log(`[Classify] Total evidence in store: ${allEvidence.length}`);
      evidence = allEvidence.find(e => e.objectId === evidenceId || e.id === evidenceId);
      console.log(`[Classify] Found by searching all: ${evidence ? 'yes' : 'no'}`);
    }
    
    // If still not found, try to sync from vault and find the object
    if (!evidence) {
      console.log(`[Classify] Syncing from vault to find object...`);
      try {
        const { objects } = await listVaultObjects(vaultId);
        console.log(`[Classify] Found ${objects.length} objects in vault`);
        const obj = objects.find(o => o.id === evidenceId);
        
        if (obj) {
          console.log(`[Classify] Found object in vault: ${obj.filename}, status: ${obj.ingestionStatus}`);
          // Create evidence item from vault object - use objectId as id for consistency
          evidence = {
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
        }
      } catch (syncError) {
        console.error('[Classify] Failed to sync from vault:', syncError);
      }
    }
    
    if (!evidence) {
      console.log(`[Classify] Evidence not found for ${evidenceId}`);
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Check if ingestion is complete
    console.log(`[Classify] Checking ingestion status for ${evidence.objectId}...`);
    const status = await getObjectStatus(vaultId, evidence.objectId);
    console.log(`[Classify] Ingestion status: ${status.ingestionStatus}`);
    
    const isImage = isImageFile(evidence.contentType);
    
    // For images, we can proceed regardless of ingestion status - we'll use OCR
    if (isImage) {
      console.log(`[Classify] Image detected, will use OCR regardless of ingestion status`);
    } else {
      // For non-images, check ingestion status
      if (status.ingestionStatus !== 'completed') {
        // If stuck at pending, try to trigger ingestion
        if (status.ingestionStatus === 'pending') {
          console.log(`[Classify] Document stuck at pending, triggering ingestion...`);
          try {
            await triggerIngestion(vaultId, evidence.objectId);
            console.log(`[Classify] Ingestion triggered for ${evidence.filename}`);
          } catch (ingestError) {
            console.error(`[Classify] Failed to trigger ingestion:`, ingestError);
          }
        }
        
        // For extraction_failed, we can still try to classify based on filename
        if (status.ingestionStatus === 'extraction_failed') {
          console.log(`[Classify] Document extraction failed, will classify based on filename`);
        } else if (status.ingestionStatus === 'processing' || status.ingestionStatus === 'pending') {
          // For processing status, wait (but frontend will timeout after 24 attempts)
          return NextResponse.json(
            { error: 'Document is still processing', status: status.ingestionStatus },
            { status: 400 }
          );
        }
      }
    }

    // Get extracted text
    console.log(`[Classify] Getting extracted text...`);
    let text = '';
    
    // For images, try OCR first
    if (isImage) {
      console.log(`[Classify] Image detected, attempting OCR...`);
      try {
        // Get the download URL for the image
        const objectStatus = await getObjectStatus(vaultId, evidence.objectId);
        if (objectStatus.downloadUrl) {
          console.log(`[Classify] Starting OCR job...`);
          const ocrJob = await processOCR(objectStatus.downloadUrl);
          console.log(`[Classify] OCR job started: ${ocrJob.id}`);
          
          // Wait for OCR to complete
          const ocrText = await waitForOCR(ocrJob.id);
          if (ocrText && ocrText.trim().length > 20) {
            // Image has meaningful text - treat as document
            text = ocrText;
            console.log(`[Classify] OCR extracted ${text.length} characters of text`);
          } else {
            console.log(`[Classify] Image has no meaningful text, classifying as photo`);
          }
        }
      } catch (ocrError) {
        console.error('[Classify] OCR failed:', ocrError);
        // Continue without OCR text
      }
    } else {
      // For non-images, get text from vault
      try {
        const textResult = await getObjectText(vaultId, evidence.objectId);
        text = textResult.text;
        console.log(`[Classify] Got ${text.length} characters of text`);
      } catch (error) {
        console.error('[Classify] Failed to get text:', error);
        // Continue with filename-based classification
      }
    }

    // If it's an image with no text, classify as photo directly
    let classification;
    if (isImage && (!text || text.trim().length <= 20)) {
      console.log(`[Classify] Classifying as photo (image with no text)`);
      classification = {
        category: 'photo' as const,
        confidence: 0.95,
        suggestedTags: ['image', 'photograph', 'visual evidence'],
        summary: `Photograph: ${evidence.filename}`,
        dateDetected: undefined,
        relevanceScore: 50,
      };
    } else {
      // Classify the evidence using LLM
      console.log(`[Classify] Calling LLM for classification...`);
      classification = await classifyEvidence(
        text || evidence.filename,
        evidence.filename,
        evidence.contentType
      );
    }
    console.log(`[Classify] Classification result: category=${classification.category}, relevance=${classification.relevanceScore}`);

    // Update evidence with classification (use evidence.id, not evidenceId from params)
    const updated = updateEvidence(vaultId, evidence.id, {
      category: classification.category,
      tags: classification.suggestedTags,
      summary: classification.summary,
      dateDetected: classification.dateDetected,
      relevanceScore: classification.relevanceScore,
      extractedText: text.substring(0, 5000), // Store first 5000 chars
      ingestionStatus: 'completed',
    });

    console.log(`[Classify] Successfully classified ${evidence.filename} as ${classification.category}`);

    return NextResponse.json({
      evidence: updated,
      classification,
    });
  } catch (error) {
    console.error('[Classify] Failed to classify evidence:', error);
    return NextResponse.json(
      { error: 'Failed to classify evidence' },
      { status: 500 }
    );
  }
}
