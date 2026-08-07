/**
 * Watany Multi-Hop Reasoning Engine
 * 
 * Handles complex questions that require multiple KB lookups.
 * Example: "كم كان راتبي في 2019 وكيف أطلب زيادة؟"
 * - Sub-query 1: Historical salary lookup
 * - Sub-query 2: Increase request procedure
 * - Synthesis: Combined answer
 */

import type { QueryUnderstanding, Intent, Entity } from './query-understanding';
import { queryUnderstanding, normalizeArabic } from './query-understanding';
import { adaptiveRetrieval, type ScoredChunk } from './adaptive-retrieval';
import type { KbChunk } from './types';

export interface SubQuestion {
  question: string;
  order: number;
  dependsOn: number[];  // IDs of sub-questions this depends on
  intent: Intent;
  entities: Entity[];
}

export interface SubQuestionAnswer {
  subQuestion: SubQuestion;
  answer: string;
  chunks: ScoredChunk[];
  confidence: number;
}

export interface MultiHopResult {
  originalQuery: string;
  subQuestions: SubQuestion[];
  subAnswers: SubQuestionAnswer[];
  synthesizedAnswer: string;
  confidence: number;
  allChunks: ScoredChunk[];
  reasoningTrace: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Query Decomposition Patterns
// ─────────────────────────────────────────────────────────────────────

/** Patterns that indicate query should be decomposed */
const DECOMPOSITION_TRIGGERS = [
  // Explicit conjunction with different topics
  /(.+?)\s*(?:و|وكمان|وكذلك|وأيضاً)\s*(.+)/,
  // Sequential actions
  /(.+?)\s*(?:ثم|بعدها|ومن ثم|بعد ذلك)\s*(.+)/,
  // Question combinations
  /(.+؟)\s*(?:و|وكمان)?\s*(.+؟)/,
];

/** Intent combinations that suggest multi-hop */
const MULTI_HOP_INTENT_PAIRS: Array<[Intent, Intent]> = [
  ['retrieve_history', 'request_action'],      // "كان راتبي X وأريد زيادة"
  ['calculate_salary', 'compare_options'],     // "احسب راتبي وقارن"
  ['find_information', 'get_procedure'],       // "ما هو X وكيف أحصل عليه"
  ['check_eligibility', 'get_procedure'],      // "هل يحق لي X وكيف أطلبه"
  ['download_form', 'get_procedure'],          // "أريد النموذج وشو الخطوات"
];

// ─────────────────────────────────────────────────────────────────────
// Multi-Hop Reasoning Engine
// ─────────────────────────────────────────────────────────────────────

export class MultiHopReasoningEngine {
  
  /**
   * Determine if a query needs multi-hop reasoning
   */
  needsMultiHop(understanding: QueryUnderstanding): boolean {
    // Explicit complexity assessment
    if (understanding.complexity === 'multi_hop') {
      return true;
    }
    
    // Multiple intents detected
    if (understanding.secondaryIntents.length > 0) {
      // Check if intent pair suggests multi-hop
      const primary = understanding.primaryIntent;
      for (const secondary of understanding.secondaryIntents) {
        if (this.isMultiHopPair(primary, secondary)) {
          return true;
        }
      }
    }
    
    // Check decomposition triggers
    for (const trigger of DECOMPOSITION_TRIGGERS) {
      if (trigger.test(understanding.originalQuery)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Execute multi-hop reasoning for a complex query
   */
  async execute(understanding: QueryUnderstanding): Promise<MultiHopResult> {
    const reasoningTrace: string[] = [];
    reasoningTrace.push(`[Multi-Hop] Starting analysis of: "${understanding.originalQuery}"`);
    
    // Step 1: Decompose the query into sub-questions
    const subQuestions = await this.decompose(understanding);
    reasoningTrace.push(`[Multi-Hop] Decomposed into ${subQuestions.length} sub-questions`);
    
    // Step 2: Execute each sub-question in order
    const subAnswers: SubQuestionAnswer[] = [];
    const allChunks: ScoredChunk[] = [];
    
    for (const subQ of subQuestions.sort((a, b) => a.order - b.order)) {
      reasoningTrace.push(`[Multi-Hop] Processing sub-question ${subQ.order}: "${subQ.question}"`);
      
      // Get context from previous answers if needed
      const previousContext = this.buildContext(subAnswers, subQ.dependsOn);
      
      // Understand the sub-question
      const subUnderstanding = await queryUnderstanding.understand(subQ.question);
      
      // Retrieve relevant chunks
      const strategy = adaptiveRetrieval.selectStrategy(subUnderstanding);
      const chunks = await adaptiveRetrieval.retrieve(subUnderstanding, strategy);
      
      allChunks.push(...chunks);
      
      // Generate sub-answer (in production, would use AI)
      const subAnswer = this.generateSubAnswer(subQ, chunks, previousContext);
      
      subAnswers.push({
        subQuestion: subQ,
        answer: subAnswer.answer,
        chunks,
        confidence: subAnswer.confidence,
      });
      
      reasoningTrace.push(`[Multi-Hop] Sub-question ${subQ.order} answered with confidence ${subAnswer.confidence.toFixed(2)}`);
    }
    
    // Step 3: Synthesize final answer
    const synthesizedAnswer = this.synthesize(understanding, subAnswers);
    reasoningTrace.push(`[Multi-Hop] Synthesized final answer`);
    
    // Step 4: Calculate overall confidence
    const confidence = this.calculateOverallConfidence(subAnswers);
    
    return {
      originalQuery: understanding.originalQuery,
      subQuestions,
      subAnswers,
      synthesizedAnswer,
      confidence,
      allChunks: this.deduplicateChunks(allChunks),
      reasoningTrace,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Query Decomposition
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Decompose a complex query into sub-questions
   */
  private async decompose(understanding: QueryUnderstanding): Promise<SubQuestion[]> {
    const subQuestions: SubQuestion[] = [];
    const query = understanding.originalQuery;
    
    // Try pattern-based decomposition first
    for (const pattern of DECOMPOSITION_TRIGGERS) {
      const match = query.match(pattern);
      if (match && match.length >= 3) {
        // Found decomposition pattern
        subQuestions.push({
          question: match[1].trim(),
          order: 1,
          dependsOn: [],
          intent: understanding.primaryIntent,
          entities: this.extractEntitiesForSegment(match[1], understanding.entities),
        });
        
        subQuestions.push({
          question: match[2].trim(),
          order: 2,
          dependsOn: [1], // May depend on first answer
          intent: understanding.secondaryIntents[0] || 'find_information',
          entities: this.extractEntitiesForSegment(match[2], understanding.entities),
        });
        
        return subQuestions;
      }
    }
    
    // Intent-based decomposition
    if (understanding.secondaryIntents.length > 0) {
      // Create sub-question for primary intent
      subQuestions.push({
        question: this.generateSubQuestionText(understanding.primaryIntent, query, understanding.entities),
        order: 1,
        dependsOn: [],
        intent: understanding.primaryIntent,
        entities: understanding.entities,
      });
      
      // Create sub-questions for secondary intents
      let order = 2;
      for (const intent of understanding.secondaryIntents.slice(0, 2)) { // Max 2 secondary
        subQuestions.push({
          question: this.generateSubQuestionText(intent, query, understanding.entities),
          order,
          dependsOn: order > 1 ? [order - 1] : [],
          intent,
          entities: understanding.entities,
        });
        order++;
      }
      
      return subQuestions;
    }
    
    // No decomposition needed - return single question
    subQuestions.push({
      question: query,
      order: 1,
      dependsOn: [],
      intent: understanding.primaryIntent,
      entities: understanding.entities,
    });
    
    return subQuestions;
  }
  
  /**
   * Generate sub-question text based on intent
   */
  private generateSubQuestionText(intent: Intent, originalQuery: string, entities: Entity[]): string {
    // Extract relevant parts from original query
    const entityValues = entities.map(e => e.value).join(' ');
    
    switch (intent) {
      case 'calculate_salary':
        return `كم راتبي ${entityValues}`;
      
      case 'calculate_pension':
        return `كم معاشي التقاعدي ${entityValues}`;
      
      case 'get_procedure':
        return `ما هي إجراءات ${entityValues}`;
      
      case 'retrieve_history':
        const yearEntity = entities.find(e => e.type === 'year');
        return yearEntity ? `ما كان ${entityValues} في ${yearEntity.value}` : originalQuery;
      
      case 'request_action':
        return `كيف أطلب ${entityValues}`;
      
      case 'download_form':
        const formEntity = entities.find(e => e.type === 'form_code');
        return formEntity ? `أين أجد نموذج ${formEntity.value}` : `أين أجد النموذج المطلوب`;
      
      case 'check_eligibility':
        return `هل يحق لي ${entityValues}`;
      
      default:
        return originalQuery;
    }
  }
  
  /**
   * Extract entities relevant to a query segment
   */
  private extractEntitiesForSegment(segment: string, allEntities: Entity[]): Entity[] {
    return allEntities.filter(e => segment.includes(e.value));
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Answer Generation
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Generate answer for a sub-question (heuristic-based for now)
   * In production, would use AI model
   */
  private generateSubAnswer(
    subQ: SubQuestion,
    chunks: ScoredChunk[],
    previousContext: string
  ): { answer: string; confidence: number } {
    if (chunks.length === 0) {
      return {
        answer: 'لا تتوفر معلومات كافية للإجابة على هذا السؤال.',
        confidence: 0.2,
      };
    }
    
    // Use top chunks to form answer
    const topChunk = chunks[0];
    const answer = this.extractAnswerFromChunk(subQ, topChunk, previousContext);
    
    // Calculate confidence based on chunk scores
    const avgScore = chunks.slice(0, 3).reduce((sum, c) => sum + c.score, 0) / Math.min(3, chunks.length);
    const confidence = Math.min(0.95, avgScore / 10);
    
    return { answer, confidence };
  }
  
  /**
   * Extract relevant answer from a chunk
   */
  private extractAnswerFromChunk(subQ: SubQuestion, chunk: ScoredChunk, context: string): string {
    // For procedural queries, look for steps
    if (subQ.intent === 'get_procedure' && chunk.chunk_type === 'steps') {
      return chunk.text;
    }
    
    // For requirements, extract requirements section
    if (chunk.chunk_type === 'requirements') {
      return `المستندات المطلوبة:\n${chunk.text}`;
    }
    
    // For overview, use the overview
    if (chunk.chunk_type === 'transaction_overview') {
      return chunk.text;
    }
    
    // Default: return chunk text truncated
    return chunk.text.length > 500 ? chunk.text.slice(0, 500) + '...' : chunk.text;
  }
  
  /**
   * Build context from previous answers
   */
  private buildContext(answers: SubQuestionAnswer[], dependsOn: number[]): string {
    if (dependsOn.length === 0) return '';
    
    const relevantAnswers = answers.filter(a => dependsOn.includes(a.subQuestion.order));
    if (relevantAnswers.length === 0) return '';
    
    return relevantAnswers
      .map(a => `[سؤال: ${a.subQuestion.question}]\n[جواب: ${a.answer}]`)
      .join('\n\n');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Answer Synthesis
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Synthesize sub-answers into a coherent final answer
   */
  private synthesize(understanding: QueryUnderstanding, subAnswers: SubQuestionAnswer[]): string {
    if (subAnswers.length === 0) {
      return 'لا تتوفر معلومات كافية للإجابة على سؤالك.';
    }
    
    if (subAnswers.length === 1) {
      return subAnswers[0].answer;
    }
    
    // Combine multiple answers with transitions
    const parts: string[] = [];
    
    for (let i = 0; i < subAnswers.length; i++) {
      const sa = subAnswers[i];
      
      if (i === 0) {
        parts.push(sa.answer);
      } else {
        // Add transition
        const transition = this.getTransition(sa.subQuestion.intent, i);
        parts.push(`\n\n${transition}\n${sa.answer}`);
      }
    }
    
    // Add conclusion
    parts.push('\n\nإذا بدك شي تاني أنا موجود لخدمتك.');
    
    return parts.join('');
  }
  
  /**
   * Get appropriate transition phrase
   */
  private getTransition(intent: Intent, position: number): string {
    const transitions: Record<Intent, string[]> = {
      get_procedure: ['بالنسبة للإجراءات:', 'أما عن الخطوات المطلوبة:'],
      request_action: ['ولطلب ذلك:', 'أما لتقديم الطلب:'],
      download_form: ['النموذج المطلوب:', 'أما عن النموذج:'],
      calculate_salary: ['بخصوص الراتب:', 'أما عن قيمة الراتب:'],
      calculate_pension: ['بخصوص المعاش:', 'أما عن المعاش التقاعدي:'],
      check_eligibility: ['بالنسبة للاستحقاق:', 'أما عن الأهلية:'],
      retrieve_history: ['تاريخياً:', 'بالنسبة للفترة السابقة:'],
      find_information: ['كذلك:', 'وأيضاً:'],
      compare_options: ['للمقارنة:', 'أما عن المقارنة:'],
      get_contact: ['للتواصل:', 'رقم الاتصال:'],
      clarify_previous: ['توضيح:', 'أي:'],
      greeting: ['', ''],
      complaint: ['بخصوص الشكوى:', 'لتقديم الشكوى:'],
    };
    
    const options = transitions[intent] || ['كذلك:', 'وأيضاً:'];
    return options[position % options.length];
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  
  private isMultiHopPair(primary: Intent, secondary: Intent): boolean {
    return MULTI_HOP_INTENT_PAIRS.some(
      ([a, b]) => (a === primary && b === secondary) || (b === primary && a === secondary)
    );
  }
  
  private calculateOverallConfidence(subAnswers: SubQuestionAnswer[]): number {
    if (subAnswers.length === 0) return 0;
    
    // Geometric mean of confidences
    const product = subAnswers.reduce((p, a) => p * a.confidence, 1);
    return Math.pow(product, 1 / subAnswers.length);
  }
  
  private deduplicateChunks(chunks: ScoredChunk[]): ScoredChunk[] {
    const seen = new Map<string, ScoredChunk>();
    for (const c of chunks) {
      if (!seen.has(c.id) || c.score > (seen.get(c.id)?.score || 0)) {
        seen.set(c.id, c);
      }
    }
    return Array.from(seen.values());
  }
}

// Singleton instance
export const multiHopReasoning = new MultiHopReasoningEngine();
