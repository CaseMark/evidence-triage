# Case.dev Evidence API Reference

Patterns for evidence management with Vaults, OCR, and LLM classification.

## Vault Management

### Create Vault
```typescript
interface CreateVaultRequest {
  name: string;
  description?: string;
}

interface Vault {
  vault_id: string;
  name: string;
  document_count: number;
  created_at: string;
}

async function createVault(name: string): Promise<Vault> {
  return casedevFetch('/vaults', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then(r => r.json());
}
```

### List Vaults
```typescript
async function listVaults(): Promise<Vault[]> {
  return casedevFetch('/vaults').then(r => r.json());
}
```

## Evidence Upload

### Upload with Progress
```typescript
interface UploadProgress {
  file: string;
  progress: number;  // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
}

async function uploadEvidence(
  vaultId: string,
  files: File[],
  onProgress: (progress: UploadProgress[]) => void
): Promise<Evidence[]> {
  const results: Evidence[] = [];
  const progress: UploadProgress[] = files.map(f => ({
    file: f.name,
    progress: 0,
    status: 'pending',
  }));
  
  for (let i = 0; i < files.length; i++) {
    progress[i].status = 'uploading';
    onProgress([...progress]);
    
    const formData = new FormData();
    formData.append('file', files[i]);
    
    const response = await fetch(
      `${BASE_URL}/vaults/${vaultId}/documents`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        body: formData,
      }
    );
    
    progress[i].progress = 100;
    progress[i].status = 'processing';
    onProgress([...progress]);
    
    const evidence = await response.json();
    results.push(evidence);
    
    progress[i].status = 'complete';
    onProgress([...progress]);
  }
  
  return results;
}
```

### Evidence Response
```typescript
interface Evidence {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  ocr_status: 'pending' | 'processing' | 'complete' | 'failed';
  extracted_text?: string;
  thumbnail_url?: string;
  download_url: string;
  metadata?: Record<string, any>;
}
```

## OCR Processing

### Automatic OCR
OCR runs automatically on upload for supported file types:
- PDF (scanned and native)
- Images (JPG, PNG, TIFF, GIF)
- Includes handwriting recognition

### Check OCR Status
```typescript
async function getOCRStatus(
  vaultId: string,
  evidenceId: string
): Promise<{ status: string; text?: string }> {
  const evidence = await casedevFetch(
    `/vaults/${vaultId}/documents/${evidenceId}`
  ).then(r => r.json());
  
  return {
    status: evidence.ocr_status,
    text: evidence.extracted_text,
  };
}
```

### Poll for OCR Completion
```typescript
async function waitForOCR(
  vaultId: string,
  evidenceId: string,
  maxWaitMs: number = 60000
): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const { status, text } = await getOCRStatus(vaultId, evidenceId);
    
    if (status === 'complete' && text) {
      return text;
    }
    
    if (status === 'failed') {
      throw new Error('OCR processing failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('OCR timeout');
}
```

## AI Classification

### Classify Evidence
```typescript
interface ClassifyRequest {
  evidence_id: string;
  categories: string[];
  score_relevance?: boolean;
  context?: string;  // Case context for better classification
}

interface ClassificationResult {
  category: string;
  confidence: number;
  relevance_score?: number;  // 0-100
  summary?: string;
  key_entities?: string[];
  suggested_tags?: string[];
}

async function classifyEvidence(
  vaultId: string,
  evidenceId: string,
  categories: string[]
): Promise<ClassificationResult> {
  return casedevFetch(`/vaults/${vaultId}/documents/${evidenceId}/classify`, {
    method: 'POST',
    body: JSON.stringify({
      categories,
      score_relevance: true,
      extract_entities: true,
    }),
  }).then(r => r.json());
}
```

### Classification Prompt
```typescript
const classificationPrompt = `Classify this document into one of the following categories:
${categories.join(', ')}

Also provide:
1. Confidence score (0-1)
2. Relevance to litigation (0-100)
3. Brief summary (1-2 sentences)
4. Key entities (names, dates, amounts)
5. Suggested tags

Document text:
{extracted_text}`;
```

### Evidence Categories
```typescript
const evidenceCategories = [
  { id: 'contract', label: 'Contract', icon: 'FileText' },
  { id: 'email', label: 'Email', icon: 'Mail' },
  { id: 'photo', label: 'Photo', icon: 'Image' },
  { id: 'handwritten_note', label: 'Handwritten Note', icon: 'Pencil' },
  { id: 'medical_record', label: 'Medical Record', icon: 'Heart' },
  { id: 'financial_document', label: 'Financial Document', icon: 'DollarSign' },
  { id: 'legal_filing', label: 'Legal Filing', icon: 'Scale' },
  { id: 'correspondence', label: 'Correspondence', icon: 'Send' },
  { id: 'report', label: 'Report', icon: 'FileBarChart' },
  { id: 'other', label: 'Other', icon: 'File' },
];
```

## Semantic Search

### Search Evidence
```typescript
interface SearchRequest {
  query: string;
  filters?: {
    categories?: string[];
    tags?: string[];
    date_range?: { start: string; end: string };
    relevance_min?: number;
  };
  limit?: number;
}

interface SearchResult {
  evidence_id: string;
  filename: string;
  category: string;
  snippet: string;
  similarity: number;
  relevance_score: number;
  tags: string[];
}

async function searchEvidence(
  vaultId: string,
  query: string,
  filters?: SearchRequest['filters']
): Promise<SearchResult[]> {
  return casedevFetch(`/vaults/${vaultId}/search`, {
    method: 'POST',
    body: JSON.stringify({ query, filters, limit: 50 }),
  }).then(r => r.json());
}
```

## Tag Management

### Update Tags
```typescript
async function updateTags(
  vaultId: string,
  evidenceId: string,
  tags: string[]
): Promise<void> {
  await casedevFetch(
    `/vaults/${vaultId}/documents/${evidenceId}/tags`,
    {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }
  );
}
```

### Add Single Tag
```typescript
async function addTag(
  vaultId: string,
  evidenceId: string,
  tag: string
): Promise<void> {
  await casedevFetch(
    `/vaults/${vaultId}/documents/${evidenceId}/tags`,
    {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }
  );
}
```

### Remove Tag
```typescript
async function removeTag(
  vaultId: string,
  evidenceId: string,
  tag: string
): Promise<void> {
  await casedevFetch(
    `/vaults/${vaultId}/documents/${evidenceId}/tags?tag=${encodeURIComponent(tag)}`,
    { method: 'DELETE' }
  );
}
```

## Rate Limits & Credit Usage

| Operation | Credits | Rate Limit |
|-----------|---------|------------|
| Upload | 1 per file | 100/min |
| OCR | 1-5 per page | Included |
| Classification | 2-5 per doc | 60/min |
| Search | 1 per query | 100/min |

## Best Practices

1. **Batch uploads** - Upload multiple files in parallel (up to 10)
2. **Wait for OCR** - Classification works better after OCR completes
3. **Provide context** - Case context improves classification accuracy
4. **Use filters** - Combine semantic search with category/tag filters
5. **Monitor credits** - Bulk operations consume credits quickly
