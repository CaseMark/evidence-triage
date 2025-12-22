import {
  VaultCreateResponse,
  UploadResponse,
  IngestResponse,
  SearchResponse,
  ChatCompletionResponse,
  OCRJobResponse,
  ClassificationResult,
  EvidenceCategory,
} from './types';

const CASE_API_BASE = 'https://api.case.dev';

function getApiKey(): string {
  const apiKey = process.env.CASEDEV_API_KEY;
  if (!apiKey) {
    throw new Error('CASEDEV_API_KEY environment variable is not set');
  }
  return apiKey;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  
  const response = await fetch(`${CASE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Vault operations
export async function createVault(name: string, description?: string): Promise<VaultCreateResponse> {
  return apiRequest<VaultCreateResponse>('/vault', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      enableGraph: false,
    }),
  });
}

export async function listVaults(): Promise<{ vaults: Array<{ id: string; name: string; description?: string; totalObjects: number; totalBytes: number; createdAt: string }> }> {
  return apiRequest('/vault', { method: 'GET' });
}

export async function getVault(vaultId: string): Promise<{ id: string; name: string; description?: string; totalObjects: number; totalBytes: number; createdAt: string }> {
  return apiRequest(`/vault/${vaultId}`, { method: 'GET' });
}

export interface VaultObject {
  id: string; 
  filename: string; 
  contentType: string;
  sizeBytes: number;
  ingestionStatus: string; 
  pageCount?: number; 
  textLength?: number; 
  chunkCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  // Evidence triage classification metadata (prefixed with et_)
  // Note: extracted text is NOT stored in metadata - fetch on-demand via /objects/{id}/text
  et_category?: string;
  et_tags?: string;
  et_summary?: string;
  et_date_detected?: string;
  et_relevance_score?: number;
  et_classified_at?: string;
}

export async function listVaultObjects(vaultId: string): Promise<{ objects: VaultObject[] }> {
  return apiRequest(`/vault/${vaultId}/objects`, { method: 'GET' });
}

// Document upload operations
export async function getUploadUrl(
  vaultId: string,
  filename: string,
  contentType: string,
  metadata?: Record<string, unknown>
): Promise<UploadResponse> {
  return apiRequest<UploadResponse>(`/vault/${vaultId}/upload`, {
    method: 'POST',
    body: JSON.stringify({
      filename,
      contentType,
      metadata,
      auto_index: true,
    }),
  });
}

export async function uploadFileToS3(
  uploadUrl: string,
  file: Blob | ArrayBuffer,
  contentType: string
): Promise<void> {
  const body = file instanceof ArrayBuffer ? new Blob([file], { type: contentType }) : file;
  
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file to S3: ${response.status}`);
  }
}

// Ingestion operations
export async function triggerIngestion(
  vaultId: string,
  objectId: string
): Promise<IngestResponse> {
  return apiRequest<IngestResponse>(`/vault/${vaultId}/ingest/${objectId}`, {
    method: 'POST',
  });
}

export async function getObjectStatus(
  vaultId: string,
  objectId: string
): Promise<{ 
  id: string; 
  filename: string; 
  contentType: string;
  sizeBytes: number;
  ingestionStatus: string; 
  pageCount?: number; 
  textLength?: number; 
  chunkCount?: number;
  downloadUrl?: string;
}> {
  return apiRequest(`/vault/${vaultId}/objects/${objectId}`, { method: 'GET' });
}

export async function getObjectText(
  vaultId: string,
  objectId: string
): Promise<{ objectId: string; filename: string; text: string; textLength: number; pageCount?: number }> {
  return apiRequest(`/vault/${vaultId}/objects/${objectId}/text`, { method: 'GET' });
}

export async function deleteVaultObject(
  vaultId: string,
  objectId: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/vault/${vaultId}/objects/${objectId}`, { method: 'DELETE' });
}

// Update object metadata (used to persist classification data)
export async function updateObjectMetadata(
  vaultId: string,
  objectId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const apiKey = getApiKey();
  
  console.log(`[Metadata] Saving metadata to vault/${vaultId}/objects/${objectId}/metadata`);
  console.log(`[Metadata] Data:`, JSON.stringify(metadata));
  
  const response = await fetch(`${CASE_API_BASE}/vault/${vaultId}/objects/${objectId}/metadata`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Metadata] Failed to update: ${response.status} - ${errorText}`);
    // Don't throw - metadata update is best-effort
  } else {
    console.log(`[Metadata] Successfully saved metadata for ${objectId}`);
  }
}

// Search operations
export async function searchVault(
  vaultId: string,
  query: string,
  topK: number = 10
): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(`/vault/${vaultId}/search`, {
    method: 'POST',
    body: JSON.stringify({
      query,
      method: 'hybrid',
      topK,
    }),
  });
}

// OCR operations
export async function processOCR(
  documentUrl: string,
  engine: 'doctr' | 'paddleocr' = 'paddleocr'
): Promise<OCRJobResponse> {
  return apiRequest<OCRJobResponse>('/ocr/v1/process', {
    method: 'POST',
    body: JSON.stringify({
      document_url: documentUrl,
      engine,
    }),
  });
}

export async function getOCRStatus(jobId: string): Promise<OCRJobResponse> {
  return apiRequest<OCRJobResponse>(`/ocr/v1/${jobId}`, { method: 'GET' });
}

export async function getOCRText(jobId: string): Promise<string> {
  const apiKey = getApiKey();
  const response = await fetch(`${CASE_API_BASE}/ocr/v1/${jobId}/download/text`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get OCR text: ${response.status}`);
  }
  
  return response.text();
}

// LLM operations
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: string = 'anthropic/claude-sonnet-4-20250514'
): Promise<ChatCompletionResponse> {
  return apiRequest<ChatCompletionResponse>('/llm/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
}

// Classification using LLM
export async function classifyEvidence(
  text: string,
  filename: string,
  contentType: string
): Promise<ClassificationResult> {
  const systemPrompt = `You are an expert legal document classifier. Analyze the provided document and classify it into one of these categories:
- contract: Legal contracts, agreements, terms of service
- email: Email correspondence, email threads
- photo: Photographs, images (non-document)
- handwritten_note: Handwritten notes, annotations, sketches
- medical_record: Medical records, health documents, lab results
- financial_document: Financial statements, invoices, receipts, bank statements
- legal_filing: Court filings, pleadings, motions, briefs
- correspondence: Letters, memos, formal correspondence (non-email)
- report: Reports, analyses, summaries
- other: Documents that don't fit other categories

Also:
1. Suggest relevant tags (3-5 tags)
2. Provide a brief summary (1-2 sentences)
3. Extract any dates mentioned
4. Rate relevance to litigation (0-100)

Respond in JSON format:
{
  "category": "category_name",
  "confidence": 0.95,
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "summary": "Brief summary of the document",
  "dateDetected": "2024-01-15 or null if no date found",
  "relevanceScore": 85
}`;

  const userPrompt = `Filename: ${filename}
Content Type: ${contentType}

Document Text (first 3000 characters):
${text.substring(0, 3000)}`;

  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const content = response.choices[0]?.message?.content || '{}';
  
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Clean up tags: remove underscores and dashes, replace with spaces
      const cleanedTags = (parsed.suggestedTags || []).map((tag: string) => 
        tag.replace(/[_-]/g, ' ')
      );
      return {
        category: parsed.category as EvidenceCategory || 'other',
        confidence: parsed.confidence || 0.5,
        suggestedTags: cleanedTags,
        summary: parsed.summary || '',
        dateDetected: parsed.dateDetected || undefined,
        relevanceScore: parsed.relevanceScore || 50,
      };
    }
  } catch (e) {
    console.error('Failed to parse classification response:', e);
  }

  // Default classification if parsing fails
  return {
    category: 'other',
    confidence: 0.5,
    suggestedTags: [],
    summary: 'Unable to classify document',
    relevanceScore: 50,
  };
}

// Relevance scoring using LLM
export async function scoreRelevance(
  text: string,
  caseContext?: string
): Promise<number> {
  const systemPrompt = `You are a legal relevance scorer. Rate the document's relevance to litigation on a scale of 0-100.

Consider:
- Does it contain evidence of wrongdoing or breach?
- Does it establish timeline of events?
- Does it identify key parties or witnesses?
- Does it contain admissions or contradictions?
- Is it a key document type (contract, communication, financial record)?

${caseContext ? `Case Context: ${caseContext}` : ''}

Respond with just a number between 0 and 100.`;

  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text.substring(0, 2000) },
  ]);

  const content = response.choices[0]?.message?.content || '50';
  const score = parseInt(content.trim(), 10);
  
  return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
}

// Helper to determine content type from filename
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    eml: 'message/rfc822',
    msg: 'application/vnd.ms-outlook',
  };
  
  return contentTypes[ext || ''] || 'application/octet-stream';
}

// Helper to check if file is an image
export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

// Helper to check if file needs OCR
export function needsOCR(contentType: string): boolean {
  return contentType === 'application/pdf' || contentType.startsWith('image/');
}
