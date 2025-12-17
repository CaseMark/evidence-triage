import { NextRequest, NextResponse } from 'next/server';
import { searchVault } from '@/lib/case-api';
import { getAllEvidence } from '@/lib/evidence-store';
import { EvidenceItem } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await request.json();
    const { query, topK = 20 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Get all evidence items first
    const allEvidence = getAllEvidence(vaultId);
    console.log(`Search: Found ${allEvidence.length} evidence items in vault ${vaultId}`);

    // Search vault using semantic/hybrid search
    let searchResults = { chunks: [], sources: [] } as { chunks: Array<{ object_id: string; hybridScore: number; text: string }>; sources: Array<{ id: string; filename: string }> };
    let useSemanticSearch = false;
    
    try {
      const apiResults = await searchVault(vaultId, query, topK);
      if (apiResults && apiResults.chunks && apiResults.chunks.length > 0) {
        searchResults = apiResults;
        useSemanticSearch = true;
        console.log(`Search: API returned ${apiResults.chunks.length} chunks`);
      } else {
        console.log('Search: API returned no chunks, falling back to local search');
      }
    } catch (error) {
      console.error('Vault search API failed:', error);
      // Fall back to local search
    }

    // Filter and rank evidence by search relevance
    let rankedEvidence: (EvidenceItem & { searchRelevance: number })[] = [];
    
    if (useSemanticSearch && searchResults.chunks.length > 0) {
      // Create a map of objectId -> hybridScore from search results
      const scoreMap = new Map<string, number>();
      for (const chunk of searchResults.chunks) {
        // Handle both snake_case and camelCase (API might return either)
        const objectId = (chunk as { object_id?: string; objectId?: string }).object_id || 
                        (chunk as { object_id?: string; objectId?: string }).objectId || '';
        const score = chunk.hybridScore || 0;
        
        // Take the highest score for each object (in case of multiple chunks)
        const currentScore = scoreMap.get(objectId) || 0;
        if (score > currentScore) {
          scoreMap.set(objectId, score);
        }
      }
      
      console.log(`Search: Score map has ${scoreMap.size} unique objects`);

      // Use semantic search results - add relevance scores
      rankedEvidence = allEvidence
        .filter(e => scoreMap.has(e.objectId))
        .map(e => ({
          ...e,
          searchRelevance: Math.round((scoreMap.get(e.objectId) || 0) * 100), // Convert to 0-100 scale
        }))
        .sort((a, b) => b.searchRelevance - a.searchRelevance);
        
      console.log(`Search: Matched ${rankedEvidence.length} evidence items from semantic search`);
    }
    
    // If semantic search returned no results, fall back to local text search
    if (rankedEvidence.length === 0) {
      console.log('Search: Using local text search fallback');
      const queryLower = query.toLowerCase();
      rankedEvidence = allEvidence
        .filter(e => {
          const filenameMatch = e.filename.toLowerCase().includes(queryLower);
          const summaryMatch = e.summary?.toLowerCase().includes(queryLower);
          const textMatch = e.extractedText?.toLowerCase().includes(queryLower);
          const tagMatch = e.tags.some(tag => tag.toLowerCase().includes(queryLower));
          const categoryMatch = e.category.toLowerCase().includes(queryLower);
          return filenameMatch || summaryMatch || textMatch || tagMatch || categoryMatch;
        })
        .map(e => {
          // Calculate a simple relevance score based on match quality
          const queryLower = query.toLowerCase();
          let score = 30; // Base score for any match
          if (e.filename.toLowerCase().includes(queryLower)) score += 30;
          if (e.summary?.toLowerCase().includes(queryLower)) score += 20;
          if (e.tags.some(tag => tag.toLowerCase().includes(queryLower))) score += 15;
          return {
            ...e,
            searchRelevance: Math.min(score, 100),
          };
        })
        .sort((a, b) => b.searchRelevance - a.searchRelevance);
        
      console.log(`Search: Local search found ${rankedEvidence.length} matches`);
    }

    return NextResponse.json({
      query,
      evidence: rankedEvidence,
      chunks: searchResults.chunks,
      sources: searchResults.sources,
      total: rankedEvidence.length,
      isSearchResult: true, // Flag to indicate these are search results with relevance
    });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
