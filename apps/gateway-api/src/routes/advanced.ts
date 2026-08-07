/**
 * Watany Advanced KB-AI Dynamics Routes
 * 
 * API endpoints for the advanced chat, analytics, and feedback system.
 */

import type { FastifyPluginAsync } from "fastify";
import {
  advancedChatHandler,
  feedbackLoop,
  queryUnderstanding,
  confidenceAssessment,
  type AdvancedChatRequest,
} from "../ai/index";

import { requireRole } from "../auth/rbac.js";

export const advancedRoutes: FastifyPluginAsync = async (app) => {
  
  // ═══════════════════════════════════════════════════════════════════
  // Advanced Chat Endpoint (v2)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * POST /api/v2/chat/advanced
   * 
   * Full advanced KB-AI pipeline:
   * - Deep query understanding
   * - Adaptive retrieval
   * - Multi-hop reasoning
   * - Confidence assessment
   * - Learning from interactions
   */
  app.post<{
    Body: {
      message: string;
      userId?: string;
      channel?: 'web' | 'whatsapp' | 'voice';
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userProfile?: {
        technicalLevel?: 'beginner' | 'intermediate' | 'expert';
        frequentTopics?: string[];
      };
    };
  }>("/api/v2/chat/advanced", async (req, reply) => {
    const { message, userId, channel, history, userProfile } = req.body;
    
    if (!message?.trim()) {
      return reply.code(400).send({ error: "message is required" });
    }
    
    try {
      const response = await advancedChatHandler.handleChat({
        message,
        userId,
        channel,
        history,
        userProfile,
      });
      
      return response;
    } catch (error) {
      app.log.error({ error }, "advanced_chat_error");
      return reply.code(500).send({ 
        error: "حصل خطأ أثناء معالجة الطلب",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // Query Understanding Endpoint
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * POST /api/v2/query/analyze
   * 
   * Analyze a query without generating a response.
   * Useful for debugging and understanding query classification.
   */
  app.post<{
    Body: { query: string; userId?: string };
  }>("/api/v2/query/analyze", async (req, reply) => {
    const { query, userId } = req.body;
    
    if (!query?.trim()) {
      return reply.code(400).send({ error: "query is required" });
    }
    
    try {
      const understanding = await queryUnderstanding.understand(query, userId);
      
      return {
        originalQuery: understanding.originalQuery,
        normalizedQuery: understanding.normalizedQuery,
        language: understanding.language,
        primaryIntent: understanding.primaryIntent,
        secondaryIntents: understanding.secondaryIntents,
        queryType: understanding.queryType,
        complexity: understanding.complexity,
        entities: understanding.entities,
        temporalContext: understanding.temporalContext,
        implicitIntents: understanding.implicitIntents,
        confidence: understanding.understandingConfidence,
        ambiguities: understanding.ambiguities,
        requiresCalculation: understanding.requiresCalculation,
        requiresComparison: understanding.requiresComparison,
        requiresMultipleSources: understanding.requiresMultipleSources,
        processingTimeMs: understanding.processingTimeMs,
      };
    } catch (error) {
      app.log.error({ error }, "query_analyze_error");
      return reply.code(500).send({ error: "Analysis failed" });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // Feedback Endpoints
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * POST /api/v2/feedback
   * 
   * Submit feedback for an interaction.
   */
  app.post<{
    Body: {
      interactionId: string;
      userId?: string;
      helpful: boolean;
      rating?: number;
      comment?: string;
      feedbackType?: 'incorrect' | 'incomplete' | 'unclear' | 'other';
    };
  }>("/api/v2/feedback", async (req, reply) => {
    const { interactionId, userId, helpful, rating, comment, feedbackType } = req.body;
    
    if (!interactionId) {
      return reply.code(400).send({ error: "interactionId is required" });
    }
    
    try {
      const feedbackId = feedbackLoop.processFeedback({
        interactionId,
        userId: userId || 'anonymous',
        helpful,
        rating,
        comment,
        feedbackType,
      });
      
      return { 
        success: true, 
        feedbackId,
        message: 'شكراً على ملاحظاتك!'
      };
    } catch (error) {
      app.log.error({ error }, "feedback_submit_error");
      return reply.code(500).send({ error: "Failed to submit feedback" });
    }
  });
  
  /**
   * GET /api/v2/feedback/stats
   * 
   * Get feedback statistics.
   */
  app.get("/api/v2/feedback/stats", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    try {
      const stats = feedbackLoop.getAnalyticsSummary();
      return stats;
    } catch (error) {
      app.log.error({ error }, "feedback_stats_error");
      return reply.code(500).send({ error: "Failed to get stats" });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // Knowledge Gap Detection
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * GET /api/v2/kb/gaps
   * 
   * Get detected knowledge gaps.
   */
  app.get("/api/v2/kb/gaps", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    try {
      const gaps = await feedbackLoop.detectKnowledgeGaps();
      return { 
        gaps: gaps.slice(0, 20),
        total: gaps.length
      };
    } catch (error) {
      app.log.error({ error }, "kb_gaps_error");
      return reply.code(500).send({ error: "Failed to detect gaps" });
    }
  });
  
  /**
   * GET /api/v2/kb/improvements
   * 
   * Get auto-generated FAQ candidates.
   */
  app.get("/api/v2/kb/improvements", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    try {
      const improvements = await feedbackLoop.autoGenerateFAQ();
      return { 
        improvements: improvements.slice(0, 20),
        total: improvements.length
      };
    } catch (error) {
      app.log.error({ error }, "kb_improvements_error");
      return reply.code(500).send({ error: "Failed to generate improvements" });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // User Profile
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * GET /api/v2/user/:userId/profile
   * 
   * Get user profile built from interaction history.
   */
  app.get<{
    Params: { userId: string };
  }>("/api/v2/user/:userId/profile", async (req, reply) => {
    const { userId } = req.params;
    
    try {
      const profile = feedbackLoop.buildUserProfile(userId);
      return profile;
    } catch (error) {
      app.log.error({ error }, "user_profile_error");
      return reply.code(500).send({ error: "Failed to build profile" });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // Analytics
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * GET /api/v2/analytics/summary
   * 
   * Get overall system analytics.
   */
  app.get("/api/v2/analytics/summary", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    try {
      const summary = feedbackLoop.getAnalyticsSummary();
      return summary;
    } catch (error) {
      app.log.error({ error }, "analytics_summary_error");
      return reply.code(500).send({ error: "Failed to get analytics" });
    }
  });
  
  /**
   * GET /api/v2/analytics/interactions
   * 
   * Get recent interactions.
   */
  app.get<{
    Querystring: { limit?: number };
  }>("/api/v2/analytics/interactions", async (req, reply) => {
    const limit = Math.min(req.query.limit || 50, 200);
    
    try {
      const store = feedbackLoop.getStore();
      const interactions = store.getRecentInteractions(limit);
      return { interactions };
    } catch (error) {
      app.log.error({ error }, "analytics_interactions_error");
      return reply.code(500).send({ error: "Failed to get interactions" });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════════
  // System Info
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * GET /api/v2/system/info
   * 
   * Get advanced system information.
   */
  app.get("/api/v2/system/info", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    return {
      version: "2.0.0",
      features: {
        queryUnderstanding: true,
        adaptiveRetrieval: true,
        multiHopReasoning: true,
        confidenceAssessment: true,
        contextualReranking: true,
        feedbackLoop: true,
        kbEvolution: true,
      },
      capabilities: {
        intents: [
          'find_information',
          'calculate_salary',
          'calculate_pension',
          'get_procedure',
          'download_form',
          'compare_options',
          'retrieve_history',
          'request_action',
          'check_eligibility',
          'get_contact',
        ],
        complexityLevels: ['simple', 'moderate', 'complex', 'multi_hop'],
        searchMethods: ['keyword', 'semantic', 'hybrid', 'temporal', 'structured'],
      },
    };
  });
};
