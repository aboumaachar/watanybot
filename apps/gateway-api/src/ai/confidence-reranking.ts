/**
 * Watany Confidence Assessment & Contextual Reranking
 * 
 * - Assesses confidence in generated answers
 * - Adapts response style based on confidence
 * - Reranks results based on user context
 * - Detects when to escalate to human support
 */

import type { QueryUnderstanding } from './query-understanding';
import type { ScoredChunk } from './adaptive-retrieval';
import type { KbChunk } from './types';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

export interface ConfidenceScore {
  score: number;           // 0-1
  level: ConfidenceLevel;
  reasons: string[];
  shouldEscalate: boolean;
  needsClarification: boolean;
}

export interface AdaptedResponse {
  answer: string;
  confidenceLevel: ConfidenceLevel;
  showSources: boolean;
  showDisclaimer: boolean;
  showEscalation: boolean;
  suggestedFollowups?: string[];
}

export interface UserProfile {
  userId: string;
  technicalLevel: 'beginner' | 'intermediate' | 'expert';
  frequentTopics: string[];
  communicationStyle: 'formal' | 'casual';
  previousQueries: number;
  satisfactionRate?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Confidence Assessment
// ─────────────────────────────────────────────────────────────────────

export class ConfidenceAssessment {
  
  /**
   * Calculate confidence score for an answer
   */
  calculateConfidence(
    understanding: QueryUnderstanding,
    retrievedChunks: ScoredChunk[],
    generatedAnswer: string
  ): ConfidenceScore {
    let confidence = 1.0;
    const reasons: string[] = [];
    
    // Factor 1: Query understanding confidence
    if (understanding.understandingConfidence < 0.7) {
      confidence *= 0.8;
      reasons.push('Query understanding uncertain');
    }
    
    // Factor 2: Ambiguities in query
    if (understanding.ambiguities.length > 0) {
      confidence *= Math.pow(0.85, understanding.ambiguities.length);
      reasons.push(`${understanding.ambiguities.length} ambiguities detected`);
    }
    
    // Factor 3: Retrieval quality
    if (retrievedChunks.length === 0) {
      confidence *= 0.3;
      reasons.push('No relevant documents found');
    } else {
      // Check average score
      const avgScore = retrievedChunks.reduce((s, c) => s + c.score, 0) / retrievedChunks.length;
      if (avgScore < 3) {
        confidence *= 0.6;
        reasons.push('Low retrieval scores');
      } else if (avgScore < 5) {
        confidence *= 0.8;
        reasons.push('Moderate retrieval scores');
      }
    }
    
    // Factor 4: Number of relevant results
    if (retrievedChunks.length < 2 && understanding.complexity !== 'simple') {
      confidence *= 0.75;
      reasons.push('Few relevant documents found');
    }
    
    // Factor 5: Answer grounding check
    const groundingScore = this.checkGrounding(generatedAnswer, retrievedChunks);
    if (groundingScore < 0.5) {
      confidence *= 0.6;
      reasons.push('Answer may not be well-grounded in sources');
    } else if (groundingScore < 0.7) {
      confidence *= 0.85;
      reasons.push('Answer partially grounded in sources');
    }
    
    // Factor 6: Query complexity vs results
    if (understanding.complexity === 'complex' && retrievedChunks.length < 3) {
      confidence *= 0.7;
      reasons.push('Complex query but limited sources');
    }
    if (understanding.complexity === 'multi_hop' && retrievedChunks.length < 4) {
      confidence *= 0.65;
      reasons.push('Multi-hop query requires more sources');
    }
    
    // Factor 7: Consistency check
    const consistency = this.checkConsistency(retrievedChunks);
    if (consistency < 0.7) {
      confidence *= 0.85;
      reasons.push('Retrieved documents have conflicting information');
    }
    
    // Determine level and flags
    const level = this.scoreToLevel(confidence);
    const shouldEscalate = confidence < 0.4;
    const needsClarification = understanding.ambiguities.length > 0;
    
    return {
      score: Math.max(0, Math.min(1, confidence)),
      level,
      reasons,
      shouldEscalate,
      needsClarification,
    };
  }
  
  /**
   * Adapt response based on confidence level
   */
  adaptResponse(
    answer: string,
    confidence: ConfidenceScore,
    understanding: QueryUnderstanding
  ): AdaptedResponse {
    
    // High confidence - direct answer
    if (confidence.level === 'high') {
      return {
        answer,
        confidenceLevel: 'high',
        showSources: false,
        showDisclaimer: false,
        showEscalation: false,
      };
    }
    
    // Medium confidence - show sources
    if (confidence.level === 'medium') {
      return {
        answer: `بناءً على المعلومات المتوفرة:\n\n${answer}`,
        confidenceLevel: 'medium',
        showSources: true,
        showDisclaimer: false,
        showEscalation: false,
        suggestedFollowups: this.generateFollowups(understanding),
      };
    }
    
    // Low confidence - express uncertainty
    if (confidence.level === 'low') {
      return {
        answer: `لست متأكداً تماماً، ولكن:\n\n${answer}\n\nيُنصح بالتحقق من المصادر الرسمية.`,
        confidenceLevel: 'low',
        showSources: true,
        showDisclaimer: true,
        showEscalation: false,
        suggestedFollowups: this.generateFollowups(understanding),
      };
    }
    
    // Very low confidence - escalate
    return {
      answer: 'لا أملك معلومات كافية للإجابة على سؤالك بثقة.\n\nهل تريد التحدث مع أحد المختصين؟',
      confidenceLevel: 'very_low',
      showSources: false,
      showDisclaimer: true,
      showEscalation: true,
      suggestedFollowups: [
        'تواصل مع خدمة ',
        'أعد صياغة السؤال',
        'جرب البحث في الموقع الرسمي',
      ],
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Check if answer is grounded in retrieved documents
   */
  private checkGrounding(answer: string, chunks: ScoredChunk[]): number {
    if (chunks.length === 0 || !answer) return 0;
    
    // Extract key phrases from answer
    const answerPhrases = this.extractKeyPhrases(answer);
    if (answerPhrases.length === 0) return 0.5; // Can't check
    
    // Check how many are found in chunks
    let foundCount = 0;
    const chunkText = chunks.map(c => c.text.toLowerCase()).join(' ');
    
    for (const phrase of answerPhrases) {
      if (chunkText.includes(phrase.toLowerCase())) {
        foundCount++;
      }
    }
    
    return foundCount / answerPhrases.length;
  }
  
  /**
   * Extract key phrases from text
   */
  private extractKeyPhrases(text: string): string[] {
    // Simple extraction: get 3-5 word sequences that look like factual claims
    const sentences = text.split(/[.،؟\n]+/).filter(s => s.trim().length > 10);
    const phrases: string[] = [];
    
    for (const sentence of sentences.slice(0, 5)) {
      // Extract noun phrases and numbers
      const matches = sentence.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){1,3}/g);
      if (matches) {
        phrases.push(...matches.slice(0, 2));
      }
      
      // Extract numbers with context
      const numMatches = sentence.match(/\d+(?:,\d{3})*(?:\.\d+)?(?:\s+[\u0600-\u06FF]+)?/g);
      if (numMatches) {
        phrases.push(...numMatches);
      }
    }
    
    return phrases.slice(0, 10);
  }
  
  /**
   * Check consistency among retrieved documents
   */
  private checkConsistency(chunks: ScoredChunk[]): number {
    if (chunks.length < 2) return 1.0; // Can't check with single chunk
    
    // Simple consistency check: look for contradicting numbers/dates
    const numbers: number[] = [];
    const years: number[] = [];
    
    for (const chunk of chunks) {
      // Extract numbers
      const numMatches = chunk.text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (numMatches) {
        numbers.push(...numMatches.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n)));
      }
      
      // Extract years
      const yearMatches = chunk.text.match(/\b(19|20)\d{2}\b/g);
      if (yearMatches) {
        years.push(...yearMatches.map(y => parseInt(y, 10)));
      }
    }
    
    // Check for large variance in numbers (might indicate inconsistency)
    if (numbers.length > 1) {
      const maxNum = Math.max(...numbers);
      const minNum = Math.min(...numbers);
      if (maxNum > 0 && minNum > 0 && maxNum / minNum > 10) {
        // Large difference - might be talking about different things
        return 0.7;
      }
    }
    
    return 1.0; // Assume consistent
  }
  
  /**
   * Convert score to confidence level
   */
  private scoreToLevel(score: number): ConfidenceLevel {
    if (score >= 0.85) return 'high';
    if (score >= 0.65) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very_low';
  }
  
  /**
   * Generate follow-up suggestions
   */
  private generateFollowups(understanding: QueryUnderstanding): string[] {
    const followups: string[] = [];
    
    // Based on implicit intents
    for (const implicit of understanding.implicitIntents.slice(0, 2)) {
      if (implicit === 'calculate_pension') {
        followups.push('هل تريد حساب معاشك التقاعدي؟');
      } else if (implicit === 'download_salary_certificate') {
        followups.push('هل تريد تحميل شهادة راتب؟');
      } else if (implicit === 'form_instructions') {
        followups.push('هل تريد معرفة كيفية تعبئة النموذج؟');
      }
    }
    
    // Based on query type
    if (understanding.queryType === 'procedural') {
      followups.push('هل تريد معرفة المستندات المطلوبة؟');
    }
    
    return followups.slice(0, 3);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Contextual Reranking
// ─────────────────────────────────────────────────────────────────────

export class ContextualReranker {
  
  /**
   * Rerank results based on user profile and context
   */
  async rerank(
    chunks: ScoredChunk[],
    understanding: QueryUnderstanding,
    userProfile?: UserProfile
  ): Promise<ScoredChunk[]> {
    if (chunks.length === 0) return [];
    
    return chunks.map(chunk => {
      let contextScore = chunk.score;
      
      // Factor 1: User expertise match
      if (userProfile) {
        contextScore *= this.expertiseBoost(chunk, userProfile);
      }
      
      // Factor 2: Query-chunk type alignment
      contextScore *= this.typeAlignmentBoost(chunk, understanding);
      
      // Factor 3: Entity match boost
      contextScore *= this.entityMatchBoost(chunk, understanding);
      
      // Factor 4: Recency (if temporal query)
      if (understanding.temporalContext.hasTemporal) {
        contextScore *= this.recencyBoost(chunk, understanding);
      }
      
      // Factor 5: Previous interaction success (if profile available)
      if (userProfile && userProfile.frequentTopics.length > 0) {
        contextScore *= this.interestBoost(chunk, userProfile);
      }
      
      return {
        ...chunk,
        rerankScore: contextScore,
        score: contextScore,
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * Boost based on user expertise level match
   */
  private expertiseBoost(chunk: ScoredChunk, profile: UserProfile): number {
    const chunkComplexity = this.assessChunkComplexity(chunk);
    
    if (profile.technicalLevel === 'beginner' && chunkComplexity === 'simple') {
      return 1.2;
    }
    if (profile.technicalLevel === 'expert' && chunkComplexity === 'technical') {
      return 1.2;
    }
    if (profile.technicalLevel === 'beginner' && chunkComplexity === 'technical') {
      return 0.8; // Deprioritize complex content for beginners
    }
    
    return 1.0;
  }
  
  /**
   * Assess complexity of a chunk
   */
  private assessChunkComplexity(chunk: ScoredChunk): 'simple' | 'moderate' | 'technical' {
    const text = chunk.text;
    
    // Technical indicators
    const technicalPatterns = [
      /قانون رقم/,
      /المادة \d+/,
      /المرسوم/,
      /بموجب أحكام/,
      /وفقاً لـ/,
    ];
    
    let technicalScore = 0;
    for (const pattern of technicalPatterns) {
      if (pattern.test(text)) technicalScore++;
    }
    
    // Length as complexity indicator
    if (text.length > 800) technicalScore++;
    
    // Legal terms
    const legalTerms = ['تشريع', 'صلاحية', 'اختصاص', 'قرار', 'نافذ'];
    for (const term of legalTerms) {
      if (text.includes(term)) technicalScore += 0.5;
    }
    
    if (technicalScore >= 3) return 'technical';
    if (technicalScore >= 1) return 'moderate';
    return 'simple';
  }
  
  /**
   * Boost based on chunk type alignment with query
   */
  private typeAlignmentBoost(chunk: ScoredChunk, understanding: QueryUnderstanding): number {
    const chunkType = chunk.chunk_type || '';
    const queryType = understanding.queryType;
    
    // Procedural queries prefer steps and requirements
    if (queryType === 'procedural') {
      if (chunkType === 'steps') return 1.4;
      if (chunkType === 'requirements') return 1.3;
      if (chunkType === 'transaction_overview') return 1.2;
    }
    
    // Calculation queries prefer structured data
    if (queryType === 'calculation') {
      if (chunkType.includes('salary') || chunkType.includes('pension')) return 1.3;
      if (chunkType.includes('table') || chunkType.includes('data')) return 1.2;
    }
    
    // Factual queries prefer overviews
    if (queryType === 'factual') {
      if (chunkType === 'transaction_overview') return 1.2;
    }
    
    return 1.0;
  }
  
  /**
   * Boost based on entity matches
   */
  private entityMatchBoost(chunk: ScoredChunk, understanding: QueryUnderstanding): number {
    let boost = 1.0;
    
    for (const entity of understanding.entities) {
      if (chunk.text.includes(entity.value)) {
        boost *= 1.15; // 15% boost per entity match
      }
    }
    
    return Math.min(1.5, boost); // Cap at 50% boost
  }
  
  /**
   * Boost based on recency
   */
  private recencyBoost(chunk: ScoredChunk, understanding: QueryUnderstanding): number {
    const currentYear = new Date().getFullYear();
    const metadata = chunk.metadata as any;
    
    // If chunk has year metadata
    if (metadata?.year) {
      const age = currentYear - metadata.year;
      return 1 / (1 + age * 0.1);
    }
    
    // Check if chunk mentions target year
    const targetYear = understanding.temporalContext.references.find(r => r.year)?.year;
    if (targetYear && chunk.text.includes(String(targetYear))) {
      return 1.3;
    }
    
    return 1.0;
  }
  
  /**
   * Boost based on user interests
   */
  private interestBoost(chunk: ScoredChunk, profile: UserProfile): number {
    const metadata = chunk.metadata as any;
    const chunkTopics = metadata?.topics || [];
    
    let matchCount = 0;
    for (const topic of profile.frequentTopics) {
      if (chunkTopics.includes(topic) || chunk.text.includes(topic)) {
        matchCount++;
      }
    }
    
    return 1 + matchCount * 0.1; // 10% boost per interest match
  }
}

// Singleton instances
export const confidenceAssessment = new ConfidenceAssessment();
export const contextualReranker = new ContextualReranker();
