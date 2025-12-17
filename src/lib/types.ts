// Evidence categories
export type EvidenceCategory = 
  | 'contract'
  | 'email'
  | 'photo'
  | 'handwritten_note'
  | 'medical_record'
  | 'financial_document'
  | 'legal_filing'
  | 'correspondence'
  | 'report'
  | 'other';

export const CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  contract: 'Contract',
  email: 'Email',
  photo: 'Photo/Image',
  handwritten_note: 'Handwritten Note',
  medical_record: 'Medical Record',
  financial_document: 'Financial Document',
  legal_filing: 'Legal Filing',
  correspondence: 'Correspondence',
  report: 'Report',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<EvidenceCategory, string> = {
  contract: 'bg-blue-100 text-blue-800',
  email: 'bg-purple-100 text-purple-800',
  photo: 'bg-green-100 text-green-800',
  handwritten_note: 'bg-yellow-100 text-yellow-800',
  medical_record: 'bg-red-100 text-red-800',
  financial_document: 'bg-emerald-100 text-emerald-800',
  legal_filing: 'bg-indigo-100 text-indigo-800',
  correspondence: 'bg-pink-100 text-pink-800',
  report: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
};

// Evidence item
export interface EvidenceItem {
  id: string;
  objectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: EvidenceCategory;
  tags: string[];
  relevanceScore: number;
  extractedText?: string;
  summary?: string;
  dateDetected?: string;
  ingestionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  thumbnailUrl?: string;
}

// Upload progress
export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'categorizing' | 'completed' | 'failed';
  error?: string;
  evidenceId?: string;
}

// Vault types
export interface Vault {
  id: string;
  name: string;
  description?: string;
  totalObjects: number;
  totalBytes: number;
  createdAt: string;
}

// API Response types
export interface VaultCreateResponse {
  id: string;
  name: string;
  description?: string;
  filesBucket: string;
  vectorBucket: string;
  indexName: string;
  region: string;
  createdAt: string;
}

export interface UploadResponse {
  objectId: string;
  uploadUrl: string;
  expiresIn: number;
  instructions: {
    method: string;
    headers: Record<string, string>;
  };
}

export interface IngestResponse {
  objectId: string;
  workflowId: string;
  status: string;
  message: string;
}

export interface SearchChunk {
  text: string;
  object_id: string;
  chunk_index: number;
  hybridScore: number;
  vectorScore: number;
  bm25Score: number;
}

export interface SearchSource {
  id: string;
  filename: string;
  pageCount?: number;
}

export interface SearchResponse {
  method: string;
  query: string;
  chunks: SearchChunk[];
  sources: SearchSource[];
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number;
  };
}

export interface OCRJobResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  document_url: string;
  engine: string;
  created_at: string;
  links: {
    self: string;
    text: string;
    json: string;
  };
}

// Filter state
export interface FilterState {
  categories: EvidenceCategory[];
  tags: string[];
  dateRange: {
    start?: string;
    end?: string;
  };
  searchQuery: string;
  sortBy: 'date' | 'relevance' | 'name';
  sortOrder: 'asc' | 'desc';
}

// View mode
export type ViewMode = 'gallery' | 'list' | 'timeline';

// Classification result from LLM
export interface ClassificationResult {
  category: EvidenceCategory;
  confidence: number;
  suggestedTags: string[];
  summary: string;
  dateDetected?: string;
  relevanceScore: number;
}
