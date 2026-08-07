/**
 * Watany Advanced Chat Handler
 * 
 * End-to-end integration of all advanced KB-AI dynamics:
 * 1. Query Understanding (deep analysis)
 * 2. Adaptive Retrieval (strategy selection)
 * 3. Multi-Hop Reasoning (complex queries)
 * 4. Contextual Reranking (personalization)
 * 5. Confidence Assessment (uncertainty handling)
 * 6. Feedback Loop (continuous learning)
 */

import type { KbChunk } from './types';
import { queryUnderstanding, type QueryUnderstanding } from './query-understanding';
import { adaptiveRetrieval, type ScoredChunk, type RetrievalStrategy } from './adaptive-retrieval';
import { multiHopReasoning, type MultiHopResult } from './multi-hop';
import { confidenceAssessment, contextualReranker, type ConfidenceScore, type AdaptedResponse, type UserProfile } from './confidence-reranking';
import { feedbackLoop } from './feedback-loop';
import { buildAiMessages, retrieveChunks } from './rag';
import { extractIntents } from './intent-extractor';
import type { ExtractedIntents } from './types';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface AdvancedChatRequest {
  message: string;
  userId?: string;
  channel?: 'web' | 'whatsapp' | 'voice';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userProfile?: Partial<UserProfile>;
}

export interface AdvancedChatResponse {
  // Main response
  answer: string;
  
  // Confidence
  confidence: ConfidenceScore;
  confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
  
  // Sources
  sources: Array<{
    id: string;
    title: string;
    text: string;
    score: number;
    chunkType: string;
  }>;
  
  // Extracted intents (for UI actions)
  intents: ExtractedIntents;
  
  // Proactive suggestions
  suggestions?: string[];
  
  // Follow-up questions
  suggestedFollowups?: string[];
  
  // Metadata
  interactionId: string;
  processingTimeMs: number;
  
  // Debug info (optional)
  debug?: {
    queryUnderstanding: Partial<QueryUnderstanding>;
    retrievalStrategy: string;
    multiHopUsed: boolean;
    reasoningTrace?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────
// Advanced Chat Handler
// ─────────────────────────────────────────────────────────────────────

export class AdvancedChatHandler {
  
  /**
   * Process a chat message with full advanced pipeline
   */
  async handleChat(
    request: AdvancedChatRequest,
    aiProvider?: (messages: any[]) => Promise<string>,
    systemPrompt?: string
  ): Promise<AdvancedChatResponse> {
    const startTime = Date.now();
    const userId = request.userId || 'anonymous';
    const channel = request.channel || 'web';
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 1: Query Understanding
    // ═══════════════════════════════════════════════════════════════
    
    const understanding = await queryUnderstanding.understand(request.message, userId);
    
    // Handle greetings specially
    if (understanding.primaryIntent === 'greeting') {
      return this.createGreetingResponse(understanding, startTime, userId, channel);
    }
    
    // Handle clarification requests
    if (understanding.ambiguities.length > 0 && understanding.understandingConfidence < 0.5) {
      return this.createClarificationResponse(understanding, startTime, userId, channel);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 2: Select Retrieval Strategy
    // ═══════════════════════════════════════════════════════════════
    
    const strategy = adaptiveRetrieval.selectStrategy(understanding);
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 3: Retrieve (Multi-hop if needed)
    // ═══════════════════════════════════════════════════════════════
    
    let chunks: ScoredChunk[];
    let multiHopResult: MultiHopResult | null = null;
    let reasoningTrace: string[] = [];
    
    if (multiHopReasoning.needsMultiHop(understanding)) {
      // Complex query - use multi-hop reasoning
      multiHopResult = await multiHopReasoning.execute(understanding);
      chunks = multiHopResult.allChunks;
      reasoningTrace = multiHopResult.reasoningTrace;
    } else {
      // Standard retrieval
      chunks = await adaptiveRetrieval.retrieve(understanding, strategy);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 4: Contextual Reranking
    // ═══════════════════════════════════════════════════════════════
    
    const userProfile = request.userProfile ? this.buildUserProfile(request.userProfile, userId) : undefined;
    const rerankedChunks = await contextualReranker.rerank(chunks, understanding, userProfile);
    
    // Take top results
    const topChunks = rerankedChunks.slice(0, strategy.numResults || 5);
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 5: Generate Response
    // ═══════════════════════════════════════════════════════════════
    
    let answer: string;
    
    if (multiHopResult) {
      // Use synthesized answer from multi-hop
      answer = multiHopResult.synthesizedAnswer;
    } else if (aiProvider) {
      // Use AI provider to generate response
      const messages = buildAiMessages(
        request.message,
        topChunks,
        request.history || [],
        systemPrompt
      );
      answer = await aiProvider(messages);
    } else {
      // Fallback: use chunks directly
      answer = this.generateFallbackAnswer(topChunks, understanding);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 6: Confidence Assessment
    // ═══════════════════════════════════════════════════════════════
    
    const confidence = confidenceAssessment.calculateConfidence(
      understanding,
      topChunks,
      answer
    );
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 7: Adapt Response
    // ═══════════════════════════════════════════════════════════════
    
    const adaptedResponse = confidenceAssessment.adaptResponse(answer, confidence, understanding);
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 8: Extract Intents
    // ═══════════════════════════════════════════════════════════════
    
    const intents = extractIntents(adaptedResponse.answer);
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 9: Generate Suggestions
    // ═══════════════════════════════════════════════════════════════
    
    const suggestions = this.generateProactiveSuggestions(understanding, userProfile);
    
    // ═══════════════════════════════════════════════════════════════
    // STAGE 10: Store Interaction
    // ═══════════════════════════════════════════════════════════════
    
    const processingTimeMs = Date.now() - startTime;
    
    const interactionId = feedbackLoop.storeInteraction({
      userId,
      query: request.message,
      understanding: {
        primaryIntent: understanding.primaryIntent,
        secondaryIntents: understanding.secondaryIntents,
        complexity: understanding.complexity,
        entities: understanding.entities,
        queryType: understanding.queryType,
      },
      answer: adaptedResponse.answer,
      confidence: confidence.score,
      sources: topChunks,
      responseTimeMs: processingTimeMs,
      channel,
    });
    
    // ═══════════════════════════════════════════════════════════════
    // Return Response
    // ═══════════════════════════════════════════════════════════════
    
    return {
      answer: adaptedResponse.answer,
      confidence,
      confidenceLevel: adaptedResponse.confidenceLevel,
      sources: topChunks.map(c => ({
        id: c.id,
        title: (c.metadata as any)?.title_ar || c.id,
        text: c.text.slice(0, 200),
        score: c.score,
        chunkType: c.chunk_type,
      })),
      intents,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      suggestedFollowups: adaptedResponse.suggestedFollowups,
      interactionId,
      processingTimeMs,
      debug: {
        queryUnderstanding: {
          primaryIntent: understanding.primaryIntent,
          secondaryIntents: understanding.secondaryIntents,
          complexity: understanding.complexity,
          queryType: understanding.queryType,
          understandingConfidence: understanding.understandingConfidence,
        },
        retrievalStrategy: strategy.name,
        multiHopUsed: multiHopResult !== null,
        reasoningTrace: reasoningTrace.length > 0 ? reasoningTrace : undefined,
      },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────
  
  private createGreetingResponse(
    understanding: QueryUnderstanding,
    startTime: number,
    userId: string,
    channel: 'web' | 'whatsapp' | 'voice'
  ): AdvancedChatResponse {
    const greetings = [
      'أهلاً وسهلاً! كيف بقدر ساعدك اليوم؟',
      'مرحباً! أنا وطني، موجود لخدمتك. شو بتحب تعرف؟',
      'مرحبا! كيف بقدر ساعدك؟',
    ];
    
    const hour = new Date().getHours();
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'صباح الخير! ';
    else if (hour < 17) timeGreeting = 'مساء الخير! ';
    else timeGreeting = 'مساء النور! ';
    
    const answer = timeGreeting + greetings[Math.floor(Math.random() * greetings.length)];
    
    const interactionId = feedbackLoop.storeInteraction({
      userId,
      query: understanding.originalQuery,
      understanding: { primaryIntent: 'greeting' },
      answer,
      confidence: 1.0,
      sources: [],
      responseTimeMs: Date.now() - startTime,
      channel,
    });
    
    return {
      answer,
      confidence: { score: 1.0, level: 'high', reasons: [], shouldEscalate: false, needsClarification: false },
      confidenceLevel: 'high',
      sources: [],
      intents: { intents: [], clarifyingQuestion: undefined },
      interactionId,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  private createClarificationResponse(
    understanding: QueryUnderstanding,
    startTime: number,
    userId: string,
    channel: 'web' | 'whatsapp' | 'voice'
  ): AdvancedChatResponse {
    const clarifyingQuestion = understanding.ambiguities[0]?.clarifyingQuestion 
      || 'ممكن توضحلي أكتر شو بدك تعرف؟';
    
    const answer = `لم أفهم سؤالك بشكل كامل. ${clarifyingQuestion}`;
    
    const interactionId = feedbackLoop.storeInteraction({
      userId,
      query: understanding.originalQuery,
      understanding: {
        primaryIntent: understanding.primaryIntent,
        ambiguities: understanding.ambiguities,
      },
      answer,
      confidence: understanding.understandingConfidence,
      sources: [],
      responseTimeMs: Date.now() - startTime,
      channel,
    });
    
    return {
      answer,
      confidence: {
        score: understanding.understandingConfidence,
        level: 'low',
        reasons: ['Query needs clarification'],
        shouldEscalate: false,
        needsClarification: true,
      },
      confidenceLevel: 'low',
      sources: [],
      intents: { intents: [], clarifyingQuestion },
      interactionId,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  private generateFallbackAnswer(chunks: ScoredChunk[], understanding: QueryUnderstanding): string {
    if (chunks.length === 0) {
      return 'ما لقيت معلومات كافية للإجابة على سؤالك. ممكن توضحلي أكتر أو تسأل بطريقة تانية؟';
    }
    
    // Use top chunk content
    const topChunk = chunks[0];
    let answer = '';
    
    // Add appropriate intro based on query type
    if (understanding.queryType === 'procedural') {
      answer = 'الإجراءات المطلوبة:\n\n';
    } else if (understanding.queryType === 'factual') {
      answer = 'بناءً على المعلومات المتوفرة:\n\n';
    }
    
    answer += topChunk.text;
    
    // Add closing
    answer += '\n\nإذا بدك شي تاني أنا موجود لخدمتك.';
    
    return answer;
  }
  
  private generateProactiveSuggestions(
    understanding: QueryUnderstanding,
    userProfile?: UserProfile
  ): string[] {
    const suggestions: string[] = [];
    
    // Based on implicit intents
    for (const implicit of understanding.implicitIntents.slice(0, 2)) {
      if (implicit === 'calculate_pension') {
        suggestions.push('هل تريد حساب معاشك التقاعدي؟');
      } else if (implicit === 'download_salary_certificate') {
        suggestions.push('هل تريد شهادة راتب رسمية؟');
      } else if (implicit === 'check_retirement_eligibility') {
        suggestions.push('هل تريد معرفة متى يحق لك التقاعد؟');
      }
    }
    
    // Seasonal suggestions
    const month = new Date().getMonth();
    if (month === 8) { // September
      suggestions.push('هل تعلم عن المنح الدراسية المتاحة؟');
    }
    
    return suggestions.slice(0, 3);
  }
  
  private buildUserProfile(partial: Partial<UserProfile>, userId: string): UserProfile {
    return {
      userId,
      technicalLevel: partial.technicalLevel || 'intermediate',
      frequentTopics: partial.frequentTopics || [],
      communicationStyle: partial.communicationStyle || 'formal',
      previousQueries: partial.previousQueries || 0,
      satisfactionRate: partial.satisfactionRate,
    };
  }
}

// Singleton instance
export const advancedChatHandler = new AdvancedChatHandler();
