/**
 * Watany Feedback Loop & KB Evolution
 * 
 * - Stores all interactions for learning
 * - Collects and analyzes user feedback
 * - Detects KB gaps
 * - Auto-generates FAQ entries
 * - Runs A/B tests for improvements
 * - Continuously improves retrieval
 */

import type { QueryUnderstanding, Intent } from './query-understanding';
import type { ScoredChunk } from './adaptive-retrieval';
import type { ConfidenceScore } from './confidence-reranking';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface Interaction {
  id: string;
  userId: string;
  timestamp: Date;
  query: string;
  queryUnderstanding: Partial<QueryUnderstanding>;
  answer: string;
  confidence: number;
  sources: Array<{ id: string; score: number }>;
  responseTimeMs: number;
  channel: 'web' | 'whatsapp' | 'voice';
}

export interface Feedback {
  id: string;
  interactionId: string;
  userId: string;
  timestamp: Date;
  helpful: boolean;
  rating?: number;  // 1-5
  comment?: string;
  feedbackType?: 'incorrect' | 'incomplete' | 'unclear' | 'other';
}

export interface KnowledgeGap {
  id: string;
  query: string;
  frequency: number;
  avgConfidence: number;
  lastSeen: Date;
  priority: number;
  status: 'pending' | 'addressed' | 'wont_fix';
  suggestedFix?: string;
}

export interface ImprovementCandidate {
  id: string;
  type: 'auto_faq' | 'kb_gap' | 'retrieval_improvement' | 'query_pattern';
  query: string;
  answer?: string;
  sourceCount: number;
  frequencyCount: number;
  avgSatisfaction: number;
  avgConfidence: number;
  needsReview: boolean;
  createdAt: Date;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  status: 'running' | 'completed' | 'cancelled';
  controlGroup: string[];
  testGroup: string[];
  metrics: {
    control: { satisfaction: number[]; confidence: number[]; responseTime: number[] };
    test: { satisfaction: number[]; confidence: number[]; responseTime: number[] };
  };
  winner?: 'control' | 'test' | 'no_difference';
}

// ─────────────────────────────────────────────────────────────────────
// In-Memory Storage (replace with DB in production)
// ─────────────────────────────────────────────────────────────────────

class InteractionStore {
  private interactions: Map<string, Interaction> = new Map();
  private feedbacks: Map<string, Feedback> = new Map();
  private gaps: Map<string, KnowledgeGap> = new Map();
  private improvements: Map<string, ImprovementCandidate> = new Map();
  private abTests: Map<string, ABTest> = new Map();
  
  // Query patterns tracking
  private queryPatterns: Map<string, { count: number; lastQuery: string; intents: Intent[] }> = new Map();
  
  generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Interaction Storage
  // ─────────────────────────────────────────────────────────────────
  
  storeInteraction(interaction: Omit<Interaction, 'id'>): string {
    const id = this.generateId();
    this.interactions.set(id, { ...interaction, id });
    
    // Track query patterns
    this.trackQueryPattern(interaction);
    
    return id;
  }
  
  getInteraction(id: string): Interaction | undefined {
    return this.interactions.get(id);
  }
  
  getRecentInteractions(limit = 100): Interaction[] {
    return Array.from(this.interactions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  getUserInteractions(userId: string, limit = 50): Interaction[] {
    return Array.from(this.interactions.values())
      .filter(i => i.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Feedback Storage
  // ─────────────────────────────────────────────────────────────────
  
  storeFeedback(feedback: Omit<Feedback, 'id'>): string {
    const id = this.generateId();
    this.feedbacks.set(id, { ...feedback, id });
    
    // If negative feedback, analyze for improvement
    if (!feedback.helpful || (feedback.rating && feedback.rating < 3)) {
      this.analyzeNegativeFeedback(feedback);
    }
    
    return id;
  }
  
  getFeedbackForInteraction(interactionId: string): Feedback[] {
    return Array.from(this.feedbacks.values())
      .filter(f => f.interactionId === interactionId);
  }
  
  getFeedbackStats(): {
    totalFeedback: number;
    positiveRate: number;
    avgRating: number;
    commonIssues: Array<{ type: string; count: number }>;
  } {
    const all = Array.from(this.feedbacks.values());
    const positive = all.filter(f => f.helpful);
    const rated = all.filter(f => f.rating !== undefined);
    
    // Count feedback types
    const typeCounts = new Map<string, number>();
    for (const f of all) {
      if (f.feedbackType) {
        typeCounts.set(f.feedbackType, (typeCounts.get(f.feedbackType) || 0) + 1);
      }
    }
    
    return {
      totalFeedback: all.length,
      positiveRate: all.length > 0 ? positive.length / all.length : 0,
      avgRating: rated.length > 0 
        ? rated.reduce((s, f) => s + (f.rating || 0), 0) / rated.length 
        : 0,
      commonIssues: Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Knowledge Gap Detection
  // ─────────────────────────────────────────────────────────────────
  
  storeGap(gap: Omit<KnowledgeGap, 'id'>): string {
    const id = this.generateId();
    this.gaps.set(id, { ...gap, id });
    return id;
  }
  
  getGaps(status?: KnowledgeGap['status']): KnowledgeGap[] {
    let gaps = Array.from(this.gaps.values());
    if (status) {
      gaps = gaps.filter(g => g.status === status);
    }
    return gaps.sort((a, b) => b.priority - a.priority);
  }
  
  updateGapStatus(id: string, status: KnowledgeGap['status']): void {
    const gap = this.gaps.get(id);
    if (gap) {
      gap.status = status;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Improvement Candidates
  // ─────────────────────────────────────────────────────────────────
  
  storeImprovement(improvement: Omit<ImprovementCandidate, 'id' | 'createdAt'>): string {
    const id = this.generateId();
    this.improvements.set(id, { ...improvement, id, createdAt: new Date() });
    return id;
  }
  
  getImprovements(needsReview?: boolean): ImprovementCandidate[] {
    let improvements = Array.from(this.improvements.values());
    if (needsReview !== undefined) {
      improvements = improvements.filter(i => i.needsReview === needsReview);
    }
    return improvements.sort((a, b) => b.frequencyCount - a.frequencyCount);
  }
  
  // ─────────────────────────────────────────────────────────────────
  // A/B Testing
  // ─────────────────────────────────────────────────────────────────
  
  createABTest(test: Omit<ABTest, 'id' | 'startDate' | 'status' | 'metrics'>): string {
    const id = this.generateId();
    this.abTests.set(id, {
      ...test,
      id,
      startDate: new Date(),
      status: 'running',
      metrics: {
        control: { satisfaction: [], confidence: [], responseTime: [] },
        test: { satisfaction: [], confidence: [], responseTime: [] },
      },
    });
    return id;
  }
  
  recordABMetric(
    testId: string,
    userId: string,
    metric: { satisfaction?: number; confidence?: number; responseTime?: number }
  ): void {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') return;
    
    const group = test.testGroup.includes(userId) ? 'test' : 
                  test.controlGroup.includes(userId) ? 'control' : null;
    
    if (!group) return;
    
    if (metric.satisfaction !== undefined) {
      test.metrics[group].satisfaction.push(metric.satisfaction);
    }
    if (metric.confidence !== undefined) {
      test.metrics[group].confidence.push(metric.confidence);
    }
    if (metric.responseTime !== undefined) {
      test.metrics[group].responseTime.push(metric.responseTime);
    }
  }
  
  analyzeABTest(testId: string): {
    controlAvg: { satisfaction: number; confidence: number; responseTime: number };
    testAvg: { satisfaction: number; confidence: number; responseTime: number };
    winner: 'control' | 'test' | 'no_difference';
    isSignificant: boolean;
  } | null {
    const test = this.abTests.get(testId);
    if (!test) return null;
    
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    const controlAvg = {
      satisfaction: avg(test.metrics.control.satisfaction),
      confidence: avg(test.metrics.control.confidence),
      responseTime: avg(test.metrics.control.responseTime),
    };
    
    const testAvg = {
      satisfaction: avg(test.metrics.test.satisfaction),
      confidence: avg(test.metrics.test.confidence),
      responseTime: avg(test.metrics.test.responseTime),
    };
    
    // Simple significance check (would use t-test in production)
    const sampleSize = Math.min(
      test.metrics.control.satisfaction.length,
      test.metrics.test.satisfaction.length
    );
    const isSignificant = sampleSize >= 30;
    
    // Determine winner
    let winner: 'control' | 'test' | 'no_difference' = 'no_difference';
    if (isSignificant) {
      const diff = testAvg.satisfaction - controlAvg.satisfaction;
      if (diff > 0.1) winner = 'test';
      else if (diff < -0.1) winner = 'control';
    }
    
    return { controlAvg, testAvg, winner, isSignificant };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────
  
  private trackQueryPattern(interaction: Omit<Interaction, 'id'>): void {
    // Normalize query for pattern matching
    const normalized = interaction.query
      .toLowerCase()
      .replace(/\d+/g, '#') // Replace numbers
      .replace(/\s+/g, ' ')
      .trim();
    
    const existing = this.queryPatterns.get(normalized);
    if (existing) {
      existing.count++;
      existing.lastQuery = interaction.query;
    } else {
      this.queryPatterns.set(normalized, {
        count: 1,
        lastQuery: interaction.query,
        intents: interaction.queryUnderstanding.primaryIntent 
          ? [interaction.queryUnderstanding.primaryIntent]
          : [],
      });
    }
  }
  
  private analyzeNegativeFeedback(feedback: Omit<Feedback, 'id'>): void {
    const interaction = this.getInteraction(feedback.interactionId);
    if (!interaction) return;
    
    // Check if this query pattern is problematic
    const normalized = interaction.query
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Track as potential gap
    const existingGap = Array.from(this.gaps.values())
      .find(g => g.query.toLowerCase().includes(normalized.slice(0, 30)));
    
    if (existingGap) {
      existingGap.frequency++;
      existingGap.avgConfidence = (existingGap.avgConfidence + interaction.confidence) / 2;
      existingGap.priority = existingGap.frequency * (1 - existingGap.avgConfidence);
      existingGap.lastSeen = new Date();
    } else if (interaction.confidence < 0.6) {
      this.storeGap({
        query: interaction.query,
        frequency: 1,
        avgConfidence: interaction.confidence,
        lastSeen: new Date(),
        priority: 1 - interaction.confidence,
        status: 'pending',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Feedback Loop Service
// ─────────────────────────────────────────────────────────────────────

export class FeedbackLoopService {
  private store: InteractionStore;
  
  constructor() {
    this.store = new InteractionStore();
  }
  
  /**
   * Store an interaction for learning
   */
  storeInteraction(data: {
    userId: string;
    query: string;
    understanding: Partial<QueryUnderstanding>;
    answer: string;
    confidence: number;
    sources: ScoredChunk[];
    responseTimeMs: number;
    channel: 'web' | 'whatsapp' | 'voice';
  }): string {
    return this.store.storeInteraction({
      userId: data.userId,
      timestamp: new Date(),
      query: data.query,
      queryUnderstanding: data.understanding,
      answer: data.answer,
      confidence: data.confidence,
      sources: data.sources.map(s => ({ id: s.id, score: s.score })),
      responseTimeMs: data.responseTimeMs,
      channel: data.channel,
    });
  }
  
  /**
   * Process user feedback
   */
  processFeedback(data: {
    interactionId: string;
    userId: string;
    helpful: boolean;
    rating?: number;
    comment?: string;
    feedbackType?: Feedback['feedbackType'];
  }): string {
    return this.store.storeFeedback({
      interactionId: data.interactionId,
      userId: data.userId,
      timestamp: new Date(),
      helpful: data.helpful,
      rating: data.rating,
      comment: data.comment,
      feedbackType: data.feedbackType,
    });
  }
  
  /**
   * Detect knowledge gaps from interactions
   */
  async detectKnowledgeGaps(): Promise<KnowledgeGap[]> {
    const interactions = this.store.getRecentInteractions(1000);
    
    // Group by similar queries with low confidence
    const queryGroups = new Map<string, { 
      queries: string[];
      confidences: number[];
      count: number;
    }>();
    
    for (const interaction of interactions) {
      if (interaction.confidence >= 0.7) continue; // Only look at low confidence
      
      // Simple normalization
      const normalized = interaction.query
        .toLowerCase()
        .replace(/\d+/g, '#')
        .slice(0, 50);
      
      const existing = queryGroups.get(normalized);
      if (existing) {
        existing.queries.push(interaction.query);
        existing.confidences.push(interaction.confidence);
        existing.count++;
      } else {
        queryGroups.set(normalized, {
          queries: [interaction.query],
          confidences: [interaction.confidence],
          count: 1,
        });
      }
    }
    
    // Convert to gaps (frequency > 3)
    const gaps: KnowledgeGap[] = [];
    for (const [key, group] of queryGroups) {
      if (group.count >= 3) {
        const avgConfidence = group.confidences.reduce((a, b) => a + b, 0) / group.confidences.length;
        
        gaps.push({
          id: this.store.generateId(),
          query: group.queries[0], // Use first query as representative
          frequency: group.count,
          avgConfidence,
          lastSeen: new Date(),
          priority: group.count * (1 - avgConfidence),
          status: 'pending',
        });
      }
    }
    
    return gaps.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Auto-generate FAQ from successful interactions
   */
  async autoGenerateFAQ(): Promise<ImprovementCandidate[]> {
    const interactions = this.store.getRecentInteractions(1000);
    const feedbackStats = this.store.getFeedbackStats();
    
    // Group by similar queries with high confidence
    const candidates = new Map<string, {
      query: string;
      answer: string;
      confidences: number[];
      count: number;
      feedbackPositive: number;
    }>();
    
    for (const interaction of interactions) {
      if (interaction.confidence < 0.8) continue; // Only high confidence
      
      const normalized = interaction.query
        .toLowerCase()
        .replace(/\d+/g, '#')
        .slice(0, 50);
      
      const existing = candidates.get(normalized);
      if (existing) {
        existing.confidences.push(interaction.confidence);
        existing.count++;
      } else {
        candidates.set(normalized, {
          query: interaction.query,
          answer: interaction.answer,
          confidences: [interaction.confidence],
          count: 1,
          feedbackPositive: 0,
        });
      }
    }
    
    // Check feedback for each candidate
    for (const [key, candidate] of candidates) {
      const relatedInteractions = interactions.filter(
        i => i.query.toLowerCase().includes(key.slice(0, 30))
      );
      
      for (const ri of relatedInteractions) {
        const feedback = this.store.getFeedbackForInteraction(ri.id);
        const positive = feedback.filter(f => f.helpful);
        candidate.feedbackPositive += positive.length;
      }
    }
    
    // Convert to improvement candidates (frequency > 10, satisfaction > 70%)
    const improvements: ImprovementCandidate[] = [];
    for (const [key, candidate] of candidates) {
      if (candidate.count >= 10) {
        const avgConfidence = candidate.confidences.reduce((a, b) => a + b, 0) / candidate.confidences.length;
        const satisfaction = candidate.count > 0 
          ? candidate.feedbackPositive / candidate.count 
          : 0.5;
        
        if (satisfaction >= 0.7 || candidate.count >= 20) {
          improvements.push({
            id: this.store.generateId(),
            type: 'auto_faq',
            query: candidate.query,
            answer: candidate.answer,
            sourceCount: 1,
            frequencyCount: candidate.count,
            avgSatisfaction: satisfaction,
            avgConfidence,
            needsReview: true,
            createdAt: new Date(),
          });
        }
      }
    }
    
    return improvements.sort((a, b) => b.frequencyCount - a.frequencyCount);
  }
  
  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): {
    totalInteractions: number;
    avgConfidence: number;
    avgResponseTime: number;
    feedbackStats: ReturnType<InteractionStore['getFeedbackStats']>;
    topGaps: KnowledgeGap[];
    pendingImprovements: number;
  } {
    const interactions = this.store.getRecentInteractions(1000);
    const feedbackStats = this.store.getFeedbackStats();
    const gaps = this.store.getGaps('pending');
    const improvements = this.store.getImprovements(true);
    
    const avgConfidence = interactions.length > 0
      ? interactions.reduce((s, i) => s + i.confidence, 0) / interactions.length
      : 0;
    
    const avgResponseTime = interactions.length > 0
      ? interactions.reduce((s, i) => s + i.responseTimeMs, 0) / interactions.length
      : 0;
    
    return {
      totalInteractions: interactions.length,
      avgConfidence,
      avgResponseTime,
      feedbackStats,
      topGaps: gaps.slice(0, 10),
      pendingImprovements: improvements.length,
    };
  }
  
  /**
   * Build user profile from interaction history
   */
  buildUserProfile(userId: string): {
    userId: string;
    interactionCount: number;
    frequentTopics: string[];
    avgSessionLength: number;
    technicalLevel: 'beginner' | 'intermediate' | 'expert';
  } {
    const interactions = this.store.getUserInteractions(userId);
    
    // Extract frequent topics
    const topicCounts = new Map<string, number>();
    for (const i of interactions) {
      const understanding = i.queryUnderstanding;
      if (understanding?.primaryIntent) {
        topicCounts.set(
          understanding.primaryIntent,
          (topicCounts.get(understanding.primaryIntent) || 0) + 1
        );
      }
    }
    
    const frequentTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
    
    // Assess technical level from query complexity
    let complexityScore = 0;
    for (const i of interactions.slice(0, 20)) {
      const complexity = i.queryUnderstanding?.complexity;
      if (complexity === 'simple') complexityScore -= 1;
      if (complexity === 'moderate') complexityScore += 0;
      if (complexity === 'complex') complexityScore += 1;
      if (complexity === 'multi_hop') complexityScore += 2;
    }
    
    let technicalLevel: 'beginner' | 'intermediate' | 'expert' = 'intermediate';
    if (complexityScore < -5) technicalLevel = 'beginner';
    else if (complexityScore > 5) technicalLevel = 'expert';
    
    return {
      userId,
      interactionCount: interactions.length,
      frequentTopics,
      avgSessionLength: 0, // Would need session tracking
      technicalLevel,
    };
  }
  
  /**
   * Access to raw store for advanced operations
   */
  getStore(): InteractionStore {
    return this.store;
  }
}

// Singleton instance
export const feedbackLoop = new FeedbackLoopService();
