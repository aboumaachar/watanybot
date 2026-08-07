/**
 * Watany Neural Cross-Encoder Reranker
 * 
 * Phase 2: Advanced neural reranking for search results
 * - Cross-encoder scoring for query-passage pairs
 * - Support for local and API-based models
 * - Calibrated confidence scoring
 * - Batch processing for efficiency
 */

import type { KbChunk } from './types';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface CrossEncoderConfig {
  provider: 'openai' | 'ollama' | 'huggingface' | 'local';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  batchSize: number;
  scoreThreshold: number;
}

export interface RerankCandidate {
  chunk: KbChunk;
  originalScore: number;
  originalRank: number;
}

export interface RerankResult {
  chunk: KbChunk;
  originalScore: number;
  crossEncoderScore: number;
  calibratedScore: number;
  finalRank: number;
  scoreBreakdown: {
    relevance: number;
    queryAlignment: number;
    passageQuality: number;
  };
}

export interface RerankSummary {
  results: RerankResult[];
  processingTimeMs: number;
  rankChanges: number;
  averageScoreShift: number;
}

// ─────────────────────────────────────────────────────────────────────
// Cross-Encoder Provider Interface
// ─────────────────────────────────────────────────────────────────────

export interface CrossEncoderProvider {
  score(query: string, passage: string): Promise<number>;
  scoreBatch(query: string, passages: string[]): Promise<number[]>;
}

// ─────────────────────────────────────────────────────────────────────
// LLM-Based Cross-Encoder (OpenAI/Ollama)
// ─────────────────────────────────────────────────────────────────────

export class LLMCrossEncoder implements CrossEncoderProvider {
  private config: CrossEncoderConfig;

  constructor(config: CrossEncoderConfig) {
    this.config = config;
  }

  async score(query: string, passage: string): Promise<number> {
    const scores = await this.scoreBatch(query, [passage]);
    return scores[0];
  }

  async scoreBatch(query: string, passages: string[]): Promise<number[]> {
    const scores: number[] = [];

    // Process in batches
    for (let i = 0; i < passages.length; i += this.config.batchSize) {
      const batch = passages.slice(i, i + this.config.batchSize);
      const batchScores = await this.scoreBatchInternal(query, batch);
      scores.push(...batchScores);
    }

    return scores;
  }

  private async scoreBatchInternal(query: string, passages: string[]): Promise<number[]> {
    const prompt = this.buildScoringPrompt(query, passages);
    
    try {
      const response = await this.callLLM(prompt);
      return this.parseScores(response, passages.length);
    } catch {
      // Return neutral scores on error
      return passages.map(() => 0.5);
    }
  }

  private buildScoringPrompt(query: string, passages: string[]): string {
    const passagesList = passages.map((p, i) => `[${i + 1}] ${p.slice(0, 500)}`).join('\n\n');

    return `أنت خبير في تقييم مدى ملاءمة النصوص للأسئلة.

السؤال: "${query}"

النصوص للتقييم:
${passagesList}

قيّم كل نص من 0 إلى 1 حسب مدى ملاءمته للإجابة على السؤال.
0 = غير ملائم تماماً
0.5 = ملائم جزئياً
1 = ملائم تماماً

أعد الدرجات فقط كأرقام مفصولة بفواصل، مثل: 0.8, 0.3, 0.9`;
  }

  private async callLLM(prompt: string): Promise<string> {
    const baseUrl = this.config.baseUrl || 
      (this.config.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1');

    if (this.config.provider === 'ollama') {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();
      return data.response || '';
    } else {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: 'أنت مقيّم دقيق لملاءمة النصوص.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 100,
          temperature: 0,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
  }

  private parseScores(response: string, expectedCount: number): number[] {
    // Extract numbers from response
    const numbers = response.match(/[\d.]+/g) || [];
    const scores = numbers
      .map(n => parseFloat(n))
      .filter(n => !isNaN(n) && n >= 0 && n <= 1);

    // Pad or truncate to expected count
    while (scores.length < expectedCount) {
      scores.push(0.5);
    }
    return scores.slice(0, expectedCount);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Local Heuristic Cross-Encoder (No API fallback)
// ─────────────────────────────────────────────────────────────────────

export class LocalCrossEncoder implements CrossEncoderProvider {
  async score(query: string, passage: string): Promise<number> {
    return this.computeScore(query, passage);
  }

  async scoreBatch(query: string, passages: string[]): Promise<number[]> {
    return passages.map(p => this.computeScore(query, p));
  }

  private computeScore(query: string, passage: string): number {
    const queryTokens = this.tokenize(query);
    const passageTokens = this.tokenize(passage);

    if (queryTokens.length === 0 || passageTokens.length === 0) {
      return 0;
    }

    // Token overlap
    const querySet = new Set(queryTokens);
    const passageSet = new Set(passageTokens);
    const intersection = new Set([...querySet].filter(t => passageSet.has(t)));
    const tokenOverlap = intersection.size / querySet.size;

    // Phrase matching
    let phraseScore = 0;
    const queryBigrams = this.getBigrams(queryTokens);
    const passageBigrams = this.getBigrams(passageTokens);
    const bigramSet = new Set(passageBigrams);
    for (const bigram of queryBigrams) {
      if (bigramSet.has(bigram)) {
        phraseScore += 0.1;
      }
    }
    phraseScore = Math.min(phraseScore, 0.3);

    // Named entity overlap (simple heuristic for Arabic)
    const namedEntityScore = this.namedEntityOverlap(query, passage);

    // Position boost (early matches score higher)
    const passageLower = passage.toLowerCase();
    let positionScore = 0;
    for (const token of queryTokens) {
      const pos = passageLower.indexOf(token);
      if (pos !== -1 && pos < 200) {
        positionScore += 0.05;
      }
    }
    positionScore = Math.min(positionScore, 0.2);

    // Passage quality (length, structure)
    const qualityScore = this.passageQuality(passage);

    // Weighted combination
    const finalScore = 
      tokenOverlap * 0.35 +
      phraseScore * 0.25 +
      namedEntityScore * 0.2 +
      positionScore * 0.1 +
      qualityScore * 0.1;

    return Math.min(Math.max(finalScore, 0), 1);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, '') // Arabic diacritics
      .split(/[\s\-_.,;:!?()\[\]{}"'،؛؟]+/)
      .filter(t => t.length > 1);
  }

  private getBigrams(tokens: string[]): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
    }
    return bigrams;
  }

  private namedEntityOverlap(query: string, passage: string): number {
    // Look for numbers, specific terms
    const numberPattern = /\d+/g;
    const queryNumbers: string[] = query.match(numberPattern) || [];
    const passageNumbers: string[] = passage.match(numberPattern) || [];
    
    let overlap = 0;
    for (const num of queryNumbers) {
      if (passageNumbers.includes(num)) {
        overlap += 0.15;
      }
    }

    // Look for specific Arabic keywords
    const importantTerms = ['قانون', 'مادة', 'راتب', 'معاش', 'إجازة', 'خدمة'];
    for (const term of importantTerms) {
      if (query.includes(term) && passage.includes(term)) {
        overlap += 0.1;
      }
    }

    return Math.min(overlap, 0.5);
  }

  private passageQuality(passage: string): number {
    const length = passage.length;
    
    // Optimal length between 100-800 characters
    let lengthScore = 0;
    if (length >= 100 && length <= 800) {
      lengthScore = 1;
    } else if (length < 100) {
      lengthScore = length / 100;
    } else {
      lengthScore = Math.max(0.5, 1 - (length - 800) / 2000);
    }

    // Has structure (numbers, bullets, sections)
    const hasStructure = /[\d\-•●]/g.test(passage) ? 0.1 : 0;

    return lengthScore * 0.8 + hasStructure + 0.1;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Neural Cross-Encoder Reranker
// ─────────────────────────────────────────────────────────────────────

export class NeuralCrossEncoderReranker {
  private provider: CrossEncoderProvider;
  private config: CrossEncoderConfig;

  constructor(config?: CrossEncoderConfig) {
    this.config = config || {
      provider: 'local',
      model: 'local',
      batchSize: 10,
      scoreThreshold: 0.3,
    };

    if (this.config.provider === 'local') {
      this.provider = new LocalCrossEncoder();
    } else {
      this.provider = new LLMCrossEncoder(this.config);
    }
  }

  /**
   * Rerank search results using cross-encoder
   */
  async rerank(query: string, candidates: RerankCandidate[], topK = 10): Promise<RerankSummary> {
    const startTime = Date.now();

    if (candidates.length === 0) {
      return {
        results: [],
        processingTimeMs: Date.now() - startTime,
        rankChanges: 0,
        averageScoreShift: 0,
      };
    }

    // Get cross-encoder scores
    const passages = candidates.map(c => c.chunk.text);
    const crossEncoderScores = await this.provider.scoreBatch(query, passages);

    // Build results with calibrated scores
    const results: RerankResult[] = candidates.map((candidate, idx) => {
      const ceScore = crossEncoderScores[idx];
      
      // Calculate score breakdown
      const scoreBreakdown = this.computeScoreBreakdown(
        query,
        candidate.chunk.text,
        ceScore
      );

      // Calibrated score combining original and cross-encoder
      const calibratedScore = this.calibrateScore(
        candidate.originalScore,
        ceScore,
        scoreBreakdown
      );

      return {
        chunk: candidate.chunk,
        originalScore: candidate.originalScore,
        crossEncoderScore: ceScore,
        calibratedScore,
        finalRank: 0, // Will be set after sorting
        scoreBreakdown,
      };
    });

    // Sort by calibrated score
    results.sort((a, b) => b.calibratedScore - a.calibratedScore);

    // Set final ranks and count changes
    let rankChanges = 0;
    let totalScoreShift = 0;

    results.forEach((result, newRank) => {
      result.finalRank = newRank + 1;
      const candidate = candidates.find(c => c.chunk.id === result.chunk.id);
      if (candidate && candidate.originalRank !== newRank + 1) {
        rankChanges++;
      }
      totalScoreShift += Math.abs(result.calibratedScore - result.originalScore);
    });

    // Apply threshold filter and limit to topK
    const filtered = results
      .filter(r => r.calibratedScore >= this.config.scoreThreshold)
      .slice(0, topK);

    return {
      results: filtered,
      processingTimeMs: Date.now() - startTime,
      rankChanges,
      averageScoreShift: totalScoreShift / results.length,
    };
  }

  /**
   * Compute detailed score breakdown
   */
  private computeScoreBreakdown(
    query: string,
    passage: string,
    ceScore: number
  ): RerankResult['scoreBreakdown'] {
    // Decompose cross-encoder score into components
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const passageTokens = new Set(passage.toLowerCase().split(/\s+/));
    
    // Query alignment (how well passage addresses query)
    const intersection = [...queryTokens].filter(t => passageTokens.has(t));
    const queryAlignment = queryTokens.size > 0 
      ? intersection.length / queryTokens.size 
      : 0;

    // Passage quality (length and structure)
    const optimalLength = passage.length >= 100 && passage.length <= 1000;
    const hasContent = passage.length > 50;
    const passageQuality = (optimalLength ? 0.7 : 0.4) + (hasContent ? 0.3 : 0);

    // Overall relevance from cross-encoder
    const relevance = ceScore;

    return {
      relevance,
      queryAlignment: Math.min(queryAlignment, 1),
      passageQuality: Math.min(passageQuality, 1),
    };
  }

  /**
   * Calibrate final score
   */
  private calibrateScore(
    originalScore: number,
    crossEncoderScore: number,
    breakdown: RerankResult['scoreBreakdown']
  ): number {
    // Weighted combination
    // Cross-encoder gets highest weight since it's the neural signal
    const weightedScore = 
      crossEncoderScore * 0.5 +
      originalScore * 0.25 +
      breakdown.queryAlignment * 0.15 +
      breakdown.passageQuality * 0.1;

    // Apply sigmoid-like smoothing for better score distribution
    return this.smoothScore(weightedScore);
  }

  /**
   * Smooth score for better distribution
   */
  private smoothScore(score: number): number {
    // Logistic sigmoid scaled to [0,1]
    const k = 5; // Steepness
    const x0 = 0.5; // Midpoint
    return 1 / (1 + Math.exp(-k * (score - x0)));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let rerankerInstance: NeuralCrossEncoderReranker | null = null;

export function getNeuralReranker(): NeuralCrossEncoderReranker {
  if (!rerankerInstance) {
    const provider = process.env.CROSS_ENCODER_PROVIDER as CrossEncoderConfig['provider'] | undefined;
    
    if (provider && provider !== 'local') {
      rerankerInstance = new NeuralCrossEncoderReranker({
        provider,
        model: process.env.CROSS_ENCODER_MODEL || 'gpt-3.5-turbo',
        baseUrl: process.env.CROSS_ENCODER_BASE_URL,
        apiKey: process.env.CROSS_ENCODER_API_KEY,
        batchSize: parseInt(process.env.CROSS_ENCODER_BATCH_SIZE || '10'),
        scoreThreshold: parseFloat(process.env.CROSS_ENCODER_THRESHOLD || '0.3'),
      });
    } else {
      rerankerInstance = new NeuralCrossEncoderReranker();
    }
  }
  return rerankerInstance;
}

export function createNeuralReranker(config: CrossEncoderConfig): NeuralCrossEncoderReranker {
  rerankerInstance = new NeuralCrossEncoderReranker(config);
  return rerankerInstance;
}
