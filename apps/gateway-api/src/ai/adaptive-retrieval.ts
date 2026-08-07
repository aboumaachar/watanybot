/**
 * Watany Adaptive Retrieval Engine
 * 
 * Chooses optimal search strategy based on query understanding.
 * Supports multiple search methods:
 * - Keyword (BM25-like)
 * - Semantic (when embeddings available)
 * - Hybrid (RRF fusion)
 * - Temporal (time-aware)
 * - Structured (SQL-like for calculations)
 */

import type { QueryUnderstanding, ComplexityLevel, Intent } from './query-understanding';
import type { KbChunk } from './types';
import { retrieveChunks as baseRetrieveChunks } from './rag';

export type SearchMethod = 
  | 'keyword'       // BM25/FTS5 - fast exact matching
  | 'semantic'      // Vector similarity (when available)
  | 'hybrid'        // Combine keyword + semantic
  | 'temporal'      // Time-aware search
  | 'structured'    // For calculations/comparisons
  | 'fuzzy';        // Typo-tolerant

export type RankingMethod = 'bm25' | 'rrf' | 'weighted' | 'recency_boost';

export interface RetrievalStrategy {
  name: string;
  searchMethods: SearchMethod[];
  ranking: RankingMethod;
  numResults: number;
  rerank: boolean;
  filters?: RetrievalFilters;
}

export interface RetrievalFilters {
  chunkTypes?: string[];
  dateRange?: { start: number; end: number };
  topics?: string[];
}

export interface ScoredChunk extends KbChunk {
  score: number;
  method?: SearchMethod;
  rerankScore?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Strategy Selection
// ─────────────────────────────────────────────────────────────────────

/**
 * Select the optimal retrieval strategy based on query understanding
 */
export function selectStrategy(understanding: QueryUnderstanding): RetrievalStrategy {
  const { complexity, queryType, requiresCalculation, requiresComparison, temporalContext, entities } = understanding;
  
  // Strategy 1: Greetings/conversational - no retrieval needed
  if (understanding.primaryIntent === 'greeting') {
    return {
      name: 'no_retrieval',
      searchMethods: [],
      ranking: 'bm25',
      numResults: 0,
      rerank: false,
    };
  }
  
  // Strategy 2: Simple factual - fast keyword search
  if (complexity === 'simple' && queryType === 'factual') {
    return {
      name: 'fast_keyword',
      searchMethods: ['keyword'],
      ranking: 'bm25',
      numResults: 3,
      rerank: false,
      filters: buildFiltersFromEntities(entities),
    };
  }
  
  // Strategy 3: Procedural queries - need steps and requirements
  if (queryType === 'procedural') {
    return {
      name: 'procedural_search',
      searchMethods: ['keyword'],
      ranking: 'weighted',
      numResults: 5,
      rerank: true,
      filters: {
        chunkTypes: ['steps', 'requirements', 'transaction_overview'],
        ...buildFiltersFromEntities(entities),
      },
    };
  }
  
  // Strategy 4: Calculation queries - need structured data
  if (requiresCalculation) {
    return {
      name: 'structured_query',
      searchMethods: ['structured', 'keyword'],
      ranking: 'weighted',
      numResults: 5,
      rerank: false,
      filters: {
        topics: ['راتب', 'معاش', 'تقاعد', 'حساب'],
        ...buildFiltersFromEntities(entities),
      },
    };
  }
  
  // Strategy 5: Temporal queries - time-aware search
  if (temporalContext.hasTemporal) {
    const dateRange = extractDateRange(temporalContext);
    return {
      name: 'temporal_search',
      searchMethods: ['temporal', 'keyword'],
      ranking: 'recency_boost',
      numResults: 7,
      rerank: true,
      filters: {
        dateRange,
        ...buildFiltersFromEntities(entities),
      },
    };
  }
  
  // Strategy 6: Comparison queries - need multiple perspectives
  if (requiresComparison) {
    return {
      name: 'comparison_search',
      searchMethods: ['keyword'],
      ranking: 'weighted',
      numResults: 10,
      rerank: true,
      filters: buildFiltersFromEntities(entities),
    };
  }
  
  // Strategy 7: Complex/Multi-hop - comprehensive search
  if (complexity === 'complex' || complexity === 'multi_hop') {
    return {
      name: 'comprehensive_search',
      searchMethods: ['hybrid'],
      ranking: 'rrf',
      numResults: 10,
      rerank: true,
      filters: buildFiltersFromEntities(entities),
    };
  }
  
  // Strategy 8: Moderate complexity - hybrid search
  if (complexity === 'moderate') {
    return {
      name: 'hybrid_search',
      searchMethods: ['hybrid'],
      ranking: 'rrf',
      numResults: 5,
      rerank: true,
      filters: buildFiltersFromEntities(entities),
    };
  }
  
  // Default: Keyword search
  return {
    name: 'default_keyword',
    searchMethods: ['keyword'],
    ranking: 'bm25',
    numResults: 5,
    rerank: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Retrieval Execution
// ─────────────────────────────────────────────────────────────────────

/**
 * Execute retrieval with the chosen strategy
 */
export async function adaptiveRetrieve(
  understanding: QueryUnderstanding,
  strategy: RetrievalStrategy
): Promise<ScoredChunk[]> {
  // No retrieval needed
  if (strategy.searchMethods.length === 0) {
    return [];
  }
  
  let results: ScoredChunk[] = [];
  
  // Execute each search method
  for (const method of strategy.searchMethods) {
    const methodResults = await executeSearch(method, understanding, strategy.filters);
    results.push(...methodResults);
  }
  
  // Deduplicate by chunk ID
  results = deduplicateResults(results);
  
  // Rank results
  results = rankResults(results, strategy.ranking, understanding);
  
  // Apply filters
  if (strategy.filters) {
    results = applyFilters(results, strategy.filters);
  }
  
  // Rerank if enabled (using cross-encoder simulation)
  if (strategy.rerank && results.length > 0) {
    results = await rerankResults(results, understanding);
  }
  
  // Return top N
  return results.slice(0, strategy.numResults);
}

// ─────────────────────────────────────────────────────────────────────
// Search Method Implementations
// ─────────────────────────────────────────────────────────────────────

async function executeSearch(
  method: SearchMethod,
  understanding: QueryUnderstanding,
  filters?: RetrievalFilters
): Promise<ScoredChunk[]> {
  switch (method) {
    case 'keyword':
      return executeKeywordSearch(understanding.originalQuery, filters);
    
    case 'hybrid':
      return executeHybridSearch(understanding, filters);
    
    case 'temporal':
      return executeTemporalSearch(understanding, filters);
    
    case 'structured':
      return executeStructuredSearch(understanding, filters);
    
    case 'fuzzy':
      return executeFuzzySearch(understanding, filters);
    
    case 'semantic':
      // Fall back to keyword if no embeddings
      return executeKeywordSearch(understanding.originalQuery, filters);
    
    default:
      return executeKeywordSearch(understanding.originalQuery, filters);
  }
}

/**
 * Keyword search using existing BM25-style implementation
 */
function executeKeywordSearch(query: string, filters?: RetrievalFilters): ScoredChunk[] {
  // Use existing RAG implementation
  const results = baseRetrieveChunks(query, 20);
  return results.map(r => ({
    ...r,
    score: (r as any).score || 0,
    method: 'keyword' as SearchMethod,
  }));
}

/**
 * Hybrid search: combine keyword with semantic (RRF fusion)
 */
async function executeHybridSearch(
  understanding: QueryUnderstanding,
  filters?: RetrievalFilters
): Promise<ScoredChunk[]> {
  // Get keyword results
  const keywordResults = executeKeywordSearch(understanding.originalQuery, filters);
  
  // In production, would also get semantic results
  // For now, we enhance keyword results with query token matching
  const enhancedResults = keywordResults.map(r => {
    let boost = 1.0;
    
    // Boost based on entity matches
    for (const entity of understanding.entities) {
      if (r.text.includes(entity.value)) {
        boost *= 1.2;
      }
    }
    
    // Boost based on chunk type relevance
    if (understanding.queryType === 'procedural') {
      if (r.chunk_type === 'steps') boost *= 1.3;
      if (r.chunk_type === 'requirements') boost *= 1.2;
    }
    
    return {
      ...r,
      score: r.score * boost,
      method: 'hybrid' as SearchMethod,
    };
  });
  
  return enhancedResults;
}

/**
 * Temporal search: prioritize recent or time-relevant content
 */
function executeTemporalSearch(
  understanding: QueryUnderstanding,
  filters?: RetrievalFilters
): ScoredChunk[] {
  const results = executeKeywordSearch(understanding.originalQuery, filters);
  
  // Extract target year from temporal context
  const targetYear = understanding.temporalContext.references
    .find(r => r.year)?.year;
  
  return results.map(r => {
    let temporalBoost = 1.0;
    
    // Check if chunk mentions the target year
    if (targetYear && r.text.includes(String(targetYear))) {
      temporalBoost = 1.5;
    }
    
    // Check metadata for date info
    const metadata = r.metadata as any;
    if (metadata?.year && targetYear) {
      const yearDiff = Math.abs(metadata.year - targetYear);
      temporalBoost *= 1 / (1 + yearDiff * 0.1);
    }
    
    return {
      ...r,
      score: r.score * temporalBoost,
      method: 'temporal' as SearchMethod,
    };
  });
}

/**
 * Structured search: for calculation-related queries
 */
function executeStructuredSearch(
  understanding: QueryUnderstanding,
  filters?: RetrievalFilters
): ScoredChunk[] {
  const results = executeKeywordSearch(understanding.originalQuery, filters);
  
  // Boost chunks that contain numbers/calculations
  const numberPattern = /\d+(?:,\d{3})*(?:\.\d+)?/g;
  
  return results.map(r => {
    let structuredBoost = 1.0;
    
    // Count numbers in chunk
    const numbers = r.text.match(numberPattern);
    if (numbers && numbers.length > 2) {
      structuredBoost = 1.3;
    }
    
    // Boost if contains calculation keywords
    if (/جدول|حساب|نسبة|معامل|قيمة/.test(r.text)) {
      structuredBoost *= 1.2;
    }
    
    return {
      ...r,
      score: r.score * structuredBoost,
      method: 'structured' as SearchMethod,
    };
  });
}

/**
 * Fuzzy search: typo-tolerant matching
 */
function executeFuzzySearch(
  understanding: QueryUnderstanding,
  filters?: RetrievalFilters
): ScoredChunk[] {
  // For now, delegate to keyword search
  // In production, would use Levenshtein distance or similar
  return executeKeywordSearch(understanding.originalQuery, filters);
}

// ─────────────────────────────────────────────────────────────────────
// Ranking & Reranking
// ─────────────────────────────────────────────────────────────────────

function rankResults(
  results: ScoredChunk[],
  method: RankingMethod,
  understanding: QueryUnderstanding
): ScoredChunk[] {
  switch (method) {
    case 'rrf':
      return reciprocalRankFusion(results);
    
    case 'recency_boost':
      return applyRecencyBoost(results);
    
    case 'weighted':
      return applyWeightedRanking(results, understanding);
    
    case 'bm25':
    default:
      return results.sort((a, b) => b.score - a.score);
  }
}

/**
 * Reciprocal Rank Fusion: combine rankings from multiple sources
 */
function reciprocalRankFusion(results: ScoredChunk[], k = 60): ScoredChunk[] {
  // Group by method
  const byMethod = new Map<string, ScoredChunk[]>();
  for (const r of results) {
    const method = r.method || 'keyword';
    if (!byMethod.has(method)) {
      byMethod.set(method, []);
    }
    byMethod.get(method)!.push(r);
  }
  
  // Calculate RRF scores
  const rrfScores = new Map<string, number>();
  
  for (const [method, methodResults] of byMethod) {
    // Sort by score within method
    methodResults.sort((a, b) => b.score - a.score);
    
    // Apply RRF formula
    methodResults.forEach((r, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const current = rrfScores.get(r.id) || 0;
      rrfScores.set(r.id, current + rrfScore);
    });
  }
  
  // Deduplicate and sort by RRF score
  const seen = new Set<string>();
  return results
    .filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .map(r => ({
      ...r,
      score: rrfScores.get(r.id) || 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Boost recent content
 */
function applyRecencyBoost(results: ScoredChunk[]): ScoredChunk[] {
  const currentYear = new Date().getFullYear();
  
  return results.map(r => {
    const metadata = r.metadata as any;
    let recencyBoost = 1.0;
    
    if (metadata?.year) {
      const age = currentYear - metadata.year;
      recencyBoost = 1 / (1 + age * 0.1);
    }
    
    return {
      ...r,
      score: r.score * recencyBoost,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Apply weighted ranking based on query type
 */
function applyWeightedRanking(
  results: ScoredChunk[],
  understanding: QueryUnderstanding
): ScoredChunk[] {
  return results.map(r => {
    let weight = 1.0;
    
    // Weight by chunk type relevance to query type
    const chunkType = r.chunk_type || '';
    
    if (understanding.queryType === 'procedural') {
      if (chunkType === 'steps') weight *= 1.4;
      if (chunkType === 'requirements') weight *= 1.3;
      if (chunkType === 'transaction_overview') weight *= 1.2;
    } else if (understanding.queryType === 'calculation') {
      if (chunkType.includes('salary') || chunkType.includes('pension')) weight *= 1.4;
    }
    
    return {
      ...r,
      score: r.score * weight,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Rerank using cross-encoder (simulated with heuristics)
 */
async function rerankResults(
  results: ScoredChunk[],
  understanding: QueryUnderstanding
): Promise<ScoredChunk[]> {
  // In production, would use a cross-encoder model
  // For now, simulate with query-document relevance scoring
  
  const queryTokens = new Set(understanding.queryTokens);
  
  return results.map(r => {
    let rerankScore = 0;
    
    // Token overlap
    const chunkTokens = r.text.toLowerCase().split(/\s+/);
    for (const token of chunkTokens) {
      if (queryTokens.has(token)) {
        rerankScore += 1;
      }
    }
    
    // Entity mentions
    for (const entity of understanding.entities) {
      if (r.text.includes(entity.value)) {
        rerankScore += 2;
      }
    }
    
    // Intent relevance
    if (understanding.primaryIntent === 'get_procedure' && r.chunk_type === 'steps') {
      rerankScore += 3;
    }
    
    // Normalize score
    const normalizedRerankScore = rerankScore / (understanding.queryTokens.length + 1);
    
    return {
      ...r,
      rerankScore: normalizedRerankScore,
      score: r.score * (1 + normalizedRerankScore * 0.5),
    };
  }).sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────

function buildFiltersFromEntities(entities: QueryUnderstanding['entities']): RetrievalFilters {
  const filters: RetrievalFilters = {};
  
  // Extract topics from entities
  const topics = entities
    .filter(e => e.type === 'topic')
    .map(e => e.value);
  
  if (topics.length > 0) {
    filters.topics = topics;
  }
  
  return filters;
}

function extractDateRange(temporal: QueryUnderstanding['temporalContext']): { start: number; end: number } | undefined {
  const years = temporal.references
    .filter(r => r.year)
    .map(r => r.year!);
  
  if (years.length === 0) return undefined;
  
  return {
    start: Math.min(...years),
    end: Math.max(...years),
  };
}

function deduplicateResults(results: ScoredChunk[]): ScoredChunk[] {
  const seen = new Map<string, ScoredChunk>();
  
  for (const r of results) {
    const existing = seen.get(r.id);
    if (!existing || r.score > existing.score) {
      seen.set(r.id, r);
    }
  }
  
  return Array.from(seen.values());
}

function applyFilters(results: ScoredChunk[], filters: RetrievalFilters): ScoredChunk[] {
  return results.filter(r => {
    // Filter by chunk type
    if (filters.chunkTypes && filters.chunkTypes.length > 0) {
      if (!filters.chunkTypes.includes(r.chunk_type)) {
        // Don't exclude, just deprioritize
        r.score *= 0.7;
      }
    }
    
    // Filter by topic
    if (filters.topics && filters.topics.length > 0) {
      const hasMatchingTopic = filters.topics.some(t => 
        r.text.includes(t) || (r.metadata as any)?.topic?.includes(t)
      );
      if (!hasMatchingTopic) {
        r.score *= 0.8;
      }
    }
    
    return true;
  });
}

// Export singleton-style access
export const adaptiveRetrieval = {
  selectStrategy,
  retrieve: adaptiveRetrieve,
};
