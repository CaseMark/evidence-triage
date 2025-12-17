import { EvidenceItem, EvidenceCategory, FilterState, UploadProgress } from './types';
import * as fs from 'fs';
import * as path from 'path';

// File-based persistence for evidence metadata
const DATA_DIR = path.join(process.cwd(), '.evidence-data');
const EVIDENCE_FILE = path.join(DATA_DIR, 'evidence.json');

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load evidence from file
function loadEvidenceFromFile(): Map<string, Map<string, EvidenceItem>> {
  try {
    ensureDataDir();
    if (fs.existsSync(EVIDENCE_FILE)) {
      const data = fs.readFileSync(EVIDENCE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const store = new Map<string, Map<string, EvidenceItem>>();
      
      for (const [vaultId, items] of Object.entries(parsed)) {
        const vaultMap = new Map<string, EvidenceItem>();
        for (const [itemId, item] of Object.entries(items as Record<string, EvidenceItem>)) {
          vaultMap.set(itemId, item as EvidenceItem);
        }
        store.set(vaultId, vaultMap);
      }
      
      console.log(`[EvidenceStore] Loaded evidence from file`);
      return store;
    }
  } catch (error) {
    console.error('[EvidenceStore] Failed to load evidence from file:', error);
  }
  return new Map();
}

// Save evidence to file
function saveEvidenceToFile(): void {
  try {
    ensureDataDir();
    const data: Record<string, Record<string, EvidenceItem>> = {};
    
    for (const [vaultId, vaultMap] of evidenceStore.entries()) {
      data[vaultId] = {};
      for (const [itemId, item] of vaultMap.entries()) {
        data[vaultId][itemId] = item;
      }
    }
    
    fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[EvidenceStore] Failed to save evidence to file:', error);
  }
}

// In-memory store for evidence items - initialized from file
const evidenceStore: Map<string, Map<string, EvidenceItem>> = loadEvidenceFromFile();
const uploadProgressStore: Map<string, UploadProgress[]> = new Map();

// Get or create vault evidence store
function getVaultStore(vaultId: string): Map<string, EvidenceItem> {
  if (!evidenceStore.has(vaultId)) {
    evidenceStore.set(vaultId, new Map());
  }
  return evidenceStore.get(vaultId)!;
}

// Evidence CRUD operations
export function addEvidence(vaultId: string, evidence: EvidenceItem): void {
  const store = getVaultStore(vaultId);
  store.set(evidence.id, evidence);
  saveEvidenceToFile();
}

export function getEvidence(vaultId: string, evidenceId: string): EvidenceItem | undefined {
  const store = getVaultStore(vaultId);
  return store.get(evidenceId);
}

export function updateEvidence(vaultId: string, evidenceId: string, updates: Partial<EvidenceItem>): EvidenceItem | undefined {
  const store = getVaultStore(vaultId);
  const existing = store.get(evidenceId);
  if (existing) {
    const updated = { ...existing, ...updates };
    store.set(evidenceId, updated);
    saveEvidenceToFile();
    return updated;
  }
  return undefined;
}

export function deleteEvidence(vaultId: string, evidenceId: string): boolean {
  const store = getVaultStore(vaultId);
  const result = store.delete(evidenceId);
  if (result) {
    saveEvidenceToFile();
  }
  return result;
}

export function getAllEvidence(vaultId: string): EvidenceItem[] {
  const store = getVaultStore(vaultId);
  return Array.from(store.values());
}

// Filter and sort evidence
export function filterEvidence(vaultId: string, filters: FilterState): EvidenceItem[] {
  let items = getAllEvidence(vaultId);

  // Filter by categories
  if (filters.categories.length > 0) {
    items = items.filter(item => filters.categories.includes(item.category));
  }

  // Filter by tags
  if (filters.tags.length > 0) {
    items = items.filter(item => 
      filters.tags.some(tag => item.tags.includes(tag))
    );
  }

  // Filter by date range
  if (filters.dateRange.start) {
    items = items.filter(item => {
      const itemDate = item.dateDetected || item.createdAt;
      return itemDate >= filters.dateRange.start!;
    });
  }
  if (filters.dateRange.end) {
    items = items.filter(item => {
      const itemDate = item.dateDetected || item.createdAt;
      return itemDate <= filters.dateRange.end!;
    });
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    items = items.filter(item =>
      item.filename.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query) ||
      item.extractedText?.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Sort
  items.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'date':
        const dateA = a.dateDetected || a.createdAt;
        const dateB = b.dateDetected || b.createdAt;
        comparison = dateA.localeCompare(dateB);
        break;
      case 'relevance':
        comparison = a.relevanceScore - b.relevanceScore;
        break;
      case 'name':
        comparison = a.filename.localeCompare(b.filename);
        break;
    }
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return items;
}

// Get unique tags from all evidence
export function getAllTags(vaultId: string): string[] {
  const items = getAllEvidence(vaultId);
  const tagSet = new Set<string>();
  items.forEach(item => {
    item.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

// Get category counts
export function getCategoryCounts(vaultId: string): Record<EvidenceCategory, number> {
  const items = getAllEvidence(vaultId);
  const counts: Record<EvidenceCategory, number> = {
    contract: 0,
    email: 0,
    photo: 0,
    handwritten_note: 0,
    medical_record: 0,
    financial_document: 0,
    legal_filing: 0,
    correspondence: 0,
    report: 0,
    other: 0,
  };
  
  items.forEach(item => {
    counts[item.category]++;
  });
  
  return counts;
}

// Upload progress tracking
export function setUploadProgress(sessionId: string, progress: UploadProgress[]): void {
  uploadProgressStore.set(sessionId, progress);
}

export function getUploadProgress(sessionId: string): UploadProgress[] {
  return uploadProgressStore.get(sessionId) || [];
}

export function updateUploadProgress(
  sessionId: string, 
  filename: string, 
  updates: Partial<UploadProgress>
): void {
  const progress = uploadProgressStore.get(sessionId) || [];
  const index = progress.findIndex(p => p.filename === filename);
  if (index >= 0) {
    progress[index] = { ...progress[index], ...updates };
    uploadProgressStore.set(sessionId, progress);
  }
}

export function clearUploadProgress(sessionId: string): void {
  uploadProgressStore.delete(sessionId);
}

// Timeline grouping
export function getEvidenceByDate(vaultId: string): Map<string, EvidenceItem[]> {
  const items = getAllEvidence(vaultId);
  const grouped = new Map<string, EvidenceItem[]>();
  
  items.forEach(item => {
    const date = item.dateDetected || item.createdAt.split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(item);
  });
  
  // Sort by date descending
  const sortedEntries = Array.from(grouped.entries()).sort((a, b) => 
    b[0].localeCompare(a[0])
  );
  
  return new Map(sortedEntries);
}

// Bulk operations
export function addBulkEvidence(vaultId: string, items: EvidenceItem[]): void {
  const store = getVaultStore(vaultId);
  items.forEach(item => {
    store.set(item.id, item);
  });
  saveEvidenceToFile();
}

export function updateBulkTags(
  vaultId: string, 
  evidenceIds: string[], 
  tagsToAdd: string[], 
  tagsToRemove: string[]
): void {
  const store = getVaultStore(vaultId);
  evidenceIds.forEach(id => {
    const item = store.get(id);
    if (item) {
      let tags = item.tags.filter(t => !tagsToRemove.includes(t));
      tags = [...new Set([...tags, ...tagsToAdd])];
      store.set(id, { ...item, tags });
    }
  });
  saveEvidenceToFile();
}

// Search with relevance ranking
export function searchEvidence(
  vaultId: string, 
  query: string,
  searchResults?: Array<{ object_id: string; hybridScore: number }>
): EvidenceItem[] {
  const items = getAllEvidence(vaultId);
  
  if (searchResults && searchResults.length > 0) {
    // Use search results for ranking
    const scoreMap = new Map(searchResults.map(r => [r.object_id, r.hybridScore]));
    
    return items
      .filter(item => scoreMap.has(item.objectId))
      .sort((a, b) => {
        const scoreA = scoreMap.get(a.objectId) || 0;
        const scoreB = scoreMap.get(b.objectId) || 0;
        return scoreB - scoreA;
      });
  }
  
  // Fallback to local search
  const queryLower = query.toLowerCase();
  return items
    .filter(item =>
      item.filename.toLowerCase().includes(queryLower) ||
      item.summary?.toLowerCase().includes(queryLower) ||
      item.extractedText?.toLowerCase().includes(queryLower) ||
      item.tags.some(tag => tag.toLowerCase().includes(queryLower))
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Clear all evidence for a vault
export function clearVaultEvidence(vaultId: string): void {
  evidenceStore.delete(vaultId);
  saveEvidenceToFile();
}
