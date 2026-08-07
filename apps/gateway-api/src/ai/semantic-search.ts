/**
 * Watany Semantic Search Engine
 * 
 * Phase 2: Vector embeddings for true semantic search
 * - Embedding generation (local or API)
 * - Vector storage and similarity search
 * - Hybrid search with RRF fusion
 */

import type { KbChunk } from './types';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'ollama' | 'custom';
  model: string;
  dimensions: number;
  baseUrl?: string;
  apiKey?: string;
  batchSize: number;
}

export interface VectorEntry {
  id: string;
  chunkId: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SemanticSearchResult {
  chunk: KbChunk;
  similarityScore: number;
  method: 'semantic';
}

// ─────────────────────────────────────────────────────────────────────
// Embedding Provider Interface
// ─────────────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

// ─────────────────────────────────────────────────────────────────────
// OpenAI-Compatible Embedding Provider
// ─────────────────────────────────────────────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }
  
  getDimensions(): number {
    return this.config.dimensions;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Local Embedding Provider (TF-IDF based for no-API fallback)
// ─────────────────────────────────────────────────────────────────────

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private dimensions: number;
  private initialized = false;
  
  constructor(dimensions = 512) {
    this.dimensions = dimensions;
  }
  
  /**
   * Initialize vocabulary from corpus
   */
  initializeFromCorpus(documents: string[]): void {
    const docFreq = new Map<string, number>();
    const totalDocs = documents.length;
    
    // Build vocabulary and document frequency
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }
    
    // Keep top N tokens by frequency
    const sortedTokens = Array.from(docFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.dimensions);
    
    // Build vocabulary and IDF
    sortedTokens.forEach(([token, freq], idx) => {
      this.vocabulary.set(token, idx);
      this.idf.set(token, Math.log(totalDocs / (1 + freq)));
    });
    
    this.initialized = true;
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.initialized) {
      // Return zero vector if not initialized
      return new Array(this.dimensions).fill(0);
    }
    
    const embedding = new Array(this.dimensions).fill(0);
    const tokens = this.tokenize(text);
    const termFreq = new Map<string, number>();
    
    // Count term frequencies
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
    
    // Calculate TF-IDF
    for (const [token, tf] of termFreq) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        const idf = this.idf.get(token) || 0;
        embedding[idx] = tf * idf;
      }
    }
    
    // L2 normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
  
  getDimensions(): number {
    return this.dimensions;
  }
  
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, '') // Arabic diacritics
      .split(/[\s\-_.,;:!?()\[\]{}"'،؛؟]+/)
      .filter(t => t.length > 1);
  }
}

// ─────────────────────────────────────────────────────────────────────
// In-Memory Vector Store
// ─────────────────────────────────────────────────────────────────────

export class VectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private chunkIndex: Map<string, KbChunk> = new Map();
  
  /**
   * Add a vector to the store
   */
  add(entry: VectorEntry, chunk: KbChunk): void {
    this.vectors.set(entry.id, entry);
    this.chunkIndex.set(entry.chunkId, chunk);
  }
  
  /**
   * Add multiple vectors
   */
  addBatch(entries: VectorEntry[], chunks: KbChunk[]): void {
    for (let i = 0; i < entries.length; i++) {
      this.add(entries[i], chunks[i]);
    }
  }
  
  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
  
  /**
   * Search for similar vectors
   */
  search(queryEmbedding: number[], topK = 10): SemanticSearchResult[] {
    const results: Array<{ entry: VectorEntry; score: number }> = [];
    
    for (const entry of this.vectors.values()) {
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ entry, score });
    }
    
    // Sort by similarity descending
    results.sort((a, b) => b.score - a.score);
    
    // Return top K with chunks
    return results.slice(0, topK).map(r => {
      const chunk = this.chunkIndex.get(r.entry.chunkId);
      return {
        chunk: chunk!,
        similarityScore: r.score,
        method: 'semantic' as const,
      };
    }).filter(r => r.chunk !== undefined);
  }
  
  /**
   * Get store size
   */
  size(): number {
    return this.vectors.size;
  }
  
  /**
   * Clear the store
   */
  clear(): void {
    this.vectors.clear();
    this.chunkIndex.clear();
  }
  
  /**
   * Export vectors for persistence
   */
  export(): { vectors: VectorEntry[]; chunks: KbChunk[] } {
    return {
      vectors: Array.from(this.vectors.values()),
      chunks: Array.from(this.chunkIndex.values()),
    };
  }
  
  /**
   * Import vectors from persistence
   */
  import(data: { vectors: VectorEntry[]; chunks: KbChunk[] }): void {
    this.clear();
    for (let i = 0; i < data.vectors.length; i++) {
      const entry = data.vectors[i];
      const chunk = data.chunks.find(c => c.id === entry.chunkId);
      if (chunk) {
        this.add(entry, chunk);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Semantic Search Engine
// ─────────────────────────────────────────────────────────────────────

export class SemanticSearchEngine {
  private embeddingProvider: EmbeddingProvider;
  private vectorStore: VectorStore;
  private initialized = false;
  
  constructor(provider?: EmbeddingProvider) {
    this.embeddingProvider = provider || new LocalEmbeddingProvider();
    this.vectorStore = new VectorStore();
  }
  
  /**
   * Index chunks for semantic search
   */
  async indexChunks(chunks: KbChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    
    // Initialize local provider from corpus if needed
    if (this.embeddingProvider instanceof LocalEmbeddingProvider) {
      this.embeddingProvider.initializeFromCorpus(chunks.map(c => c.text));
    }
    
    // Generate embeddings in batches
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await this.embeddingProvider.embedBatch(texts);
      
      const entries: VectorEntry[] = embeddings.map((embedding, idx) => ({
        id: `vec_${batch[idx].id}`,
        chunkId: batch[idx].id,
        embedding,
        metadata: batch[idx].metadata || {},
      }));
      
      this.vectorStore.addBatch(entries, batch);
    }
    
    this.initialized = true;
  }
  
  /**
   * Search for semantically similar chunks
   */
  async search(query: string, topK = 10): Promise<SemanticSearchResult[]> {
    if (!this.initialized || this.vectorStore.size() === 0) {
      return [];
    }
    
    const queryEmbedding = await this.embeddingProvider.embed(query);
    return this.vectorStore.search(queryEmbedding, topK);
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get index size
   */
  getIndexSize(): number {
    return this.vectorStore.size();
  }
  
  /**
   * Export for persistence
   */
  exportIndex(): { vectors: VectorEntry[]; chunks: KbChunk[] } {
    return this.vectorStore.export();
  }
  
  /**
   * Import from persistence
   */
  importIndex(data: { vectors: VectorEntry[]; chunks: KbChunk[] }): void {
    this.vectorStore.import(data);
    this.initialized = true;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hybrid Search (Keyword + Semantic with RRF)
// ─────────────────────────────────────────────────────────────────────

export interface HybridSearchResult {
  chunk: KbChunk;
  keywordScore: number;
  semanticScore: number;
  fusedScore: number;
}

/**
 * Reciprocal Rank Fusion for combining search results
 */
export function reciprocalRankFusion(
  keywordResults: Array<{ chunk: KbChunk; score: number }>,
  semanticResults: SemanticSearchResult[],
  k = 60,
  keywordWeight = 0.5,
  semanticWeight = 0.5
): HybridSearchResult[] {
  const scores = new Map<string, { keyword: number; semantic: number; chunk: KbChunk }>();
  
  // Process keyword results
  keywordResults.forEach((result, rank) => {
    const rrfScore = keywordWeight / (k + rank + 1);
    scores.set(result.chunk.id, {
      keyword: rrfScore,
      semantic: 0,
      chunk: result.chunk,
    });
  });
  
  // Process semantic results
  semanticResults.forEach((result, rank) => {
    const rrfScore = semanticWeight / (k + rank + 1);
    const existing = scores.get(result.chunk.id);
    
    if (existing) {
      existing.semantic = rrfScore;
    } else {
      scores.set(result.chunk.id, {
        keyword: 0,
        semantic: rrfScore,
        chunk: result.chunk,
      });
    }
  });
  
  // Combine and sort
  return Array.from(scores.values())
    .map(entry => ({
      chunk: entry.chunk,
      keywordScore: entry.keyword,
      semanticScore: entry.semantic,
      fusedScore: entry.keyword + entry.semantic,
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore);
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let semanticSearchInstance: SemanticSearchEngine | null = null;

export function getSemanticSearchEngine(): SemanticSearchEngine {
  if (!semanticSearchInstance) {
    semanticSearchInstance = new SemanticSearchEngine();
  }
  return semanticSearchInstance;
}

export function createSemanticSearchEngine(config: EmbeddingConfig): SemanticSearchEngine {
  let provider: EmbeddingProvider;
  
  switch (config.provider) {
    case 'openai':
    case 'ollama':
    case 'custom':
      provider = new OpenAIEmbeddingProvider(config);
      break;
    case 'local':
    default:
      provider = new LocalEmbeddingProvider(config.dimensions);
      break;
  }
  
  semanticSearchInstance = new SemanticSearchEngine(provider);
  return semanticSearchInstance;
}
