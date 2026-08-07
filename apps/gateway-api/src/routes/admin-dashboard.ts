/**
 * Watany Admin Dashboard API Routes
 * 
 * Phase 3: Comprehensive admin and analytics endpoints
 * - Dashboard overview
 * - Session analytics
 * - A/B test management
 * - KB health and gaps
 * - User management
 * - System monitoring
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSessionStore } from '../ai/session-tracking';
import { getABTestEngine } from '../ai/ab-testing';
import { feedbackLoop } from '../ai/feedback-loop';
import { requireRole } from '../auth/rbac.js';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
  period?: 'hour' | 'day' | 'week' | 'month';
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────

function parseDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getDateRange(query: DateRangeQuery): { start: Date; end: Date } {
  const end = parseDate(query.endDate) || new Date();
  let start = parseDate(query.startDate);

  if (!start) {
    // Default based on period
    switch (query.period) {
      case 'hour':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
  }

  return { start, end };
}

// ─────────────────────────────────────────────────────────────────────
// Routes Registration
// ─────────────────────────────────────────────────────────────────────

export async function adminDashboardRoutes(app: FastifyInstance): Promise<void> {
  
  // ─────────────────────────────────────────────────────────────────
  // Dashboard Overview
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/dashboard
   * Main dashboard overview with key metrics
   */
  app.get('/api/admin/dashboard', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const sessionStore = getSessionStore();
    const abEngine = getABTestEngine();

    const sessionStats = sessionStore.getStats();
    const abSummary = abEngine.getSummary();
    const feedbackSummary = feedbackLoop.getAnalyticsSummary();
    const kbGaps = await feedbackLoop.detectKnowledgeGaps();

    return reply.send({
      success: true,
      data: {
        sessions: {
          active: sessionStats.activeSessions,
          total: sessionStats.totalSessions,
          avgTurnCount: sessionStats.avgTurnCount.toFixed(2),
          avgResponseTime: sessionStats.avgResponseTime.toFixed(0) + 'ms',
        },
        abTests: {
          running: abSummary.running,
          completed: abSummary.completed,
          recentWinners: abSummary.winners.slice(0, 5),
        },
        feedback: {
          totalInteractions: feedbackSummary.totalInteractions,
          avgConfidence: (feedbackSummary.avgConfidence * 100).toFixed(1) + '%',
          positiveRate: (feedbackSummary.feedbackStats.positiveRate * 100).toFixed(1) + '%',
          avgRating: feedbackSummary.feedbackStats.avgRating.toFixed(1),
        },
        kbHealth: {
          gapsCount: kbGaps.length,
          topGaps: kbGaps.slice(0, 5).map((g: { query: string; frequency: number; priority: number }) => {
            let severity: string;
            if (g.priority > 5) { severity = 'high'; }
            else if (g.priority > 2) { severity = 'medium'; }
            else { severity = 'low'; }
            return { topic: g.query, frequency: g.frequency, severity };
          }),
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Session Analytics
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/analytics/sessions
   * Detailed session analytics
   */
  app.get('/api/admin/analytics/sessions', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as DateRangeQuery & PaginationQuery;
    const sessionStore = getSessionStore();

    const stats = sessionStore.getStats();
    const sessions = sessionStore.export();

    // Filter by date range
    const { start, end } = getDateRange(query);
    const filteredSessions = sessions.filter(s => {
      const created = new Date(s.createdAt);
      return created >= start && created <= end;
    });

    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;
    const paginatedSessions = filteredSessions.slice(offset, offset + limit);

    // Aggregate metrics
    const channelBreakdown = {
      web: filteredSessions.filter(s => s.channel === 'web').length,
      whatsapp: filteredSessions.filter(s => s.channel === 'whatsapp').length,
      api: filteredSessions.filter(s => s.channel === 'api').length,
    };

    const stateBreakdown = {
      active: filteredSessions.filter(s => s.state === 'active').length,
      idle: filteredSessions.filter(s => s.state === 'idle').length,
      completed: filteredSessions.filter(s => s.state === 'completed').length,
      expired: filteredSessions.filter(s => s.state === 'expired').length,
    };

    return reply.send({
      success: true,
      data: {
        overview: stats,
        channelBreakdown,
        stateBreakdown,
        sessions: paginatedSessions.map(s => ({
          id: s.id,
          userId: s.userId,
          channel: s.channel,
          state: s.state,
          turnCount: s.analytics.turnCount,
          avgConfidence: s.analytics.avgConfidence.toFixed(2),
          topicsDiscussed: s.analytics.topicsDiscussed,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total: filteredSessions.length,
          pages: Math.ceil(filteredSessions.length / limit),
        },
        dateRange: { start, end },
      },
    });
  });

  /**
   * GET /api/admin/analytics/sessions/:sessionId
   * Single session details
   */
  app.get('/api/admin/analytics/sessions/:sessionId', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };
    const sessionStore = getSessionStore();

    const session = sessionStore.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: 'Session not found',
      });
    }

    // Convert complex types for JSON
    const context = {
      topic: session.context.topic,
      entities: Object.fromEntries(session.context.entities),
      referencedChunks: Array.from(session.context.referencedChunks),
      clarifications: session.context.clarifications,
      userPreferences: session.context.userPreferences,
    };

    return reply.send({
      success: true,
      data: {
        ...session,
        context,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // A/B Test Management
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/experiments
   * List all experiments
   */
  app.get('/api/admin/experiments', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string };
    const abEngine = getABTestEngine();

    const status = query.status as 'draft' | 'running' | 'paused' | 'completed' | 'archived' | undefined;
    const experiments = abEngine.listExperiments(status);

    return reply.send({
      success: true,
      data: {
        experiments: experiments.map(exp => ({
          id: exp.id,
          name: exp.name,
          description: exp.description,
          status: exp.status,
          variantCount: exp.variants.length,
          targetMetric: exp.targetMetric,
          createdAt: exp.createdAt,
          startedAt: exp.startedAt,
          winner: exp.winner,
        })),
        summary: abEngine.getSummary(),
      },
    });
  });

  /**
   * POST /api/admin/experiments
   * Create new experiment
   */
  app.post('/api/admin/experiments', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description: string;
      hypothesis: string;
      variants: Array<{ name: string; description: string; config: Record<string, unknown>; weight: number }>;
      targetMetric?: string;
      minimumSampleSize?: number;
    };

    const abEngine = getABTestEngine();

    try {
      const experiment = abEngine.createExperiment({
        name: body.name,
        description: body.description,
        hypothesis: body.hypothesis,
        variants: body.variants,
        targetMetric: body.targetMetric as keyof import('../ai/ab-testing').ExperimentMetrics,
        minimumSampleSize: body.minimumSampleSize,
      });

      return reply.status(201).send({
        success: true,
        data: experiment,
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/admin/experiments/:experimentId
   * Get experiment details and analysis
   */
  app.get('/api/admin/experiments/:experimentId', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const abEngine = getABTestEngine();

    const analysis = abEngine.analyzeExperiment(experimentId);
    if (!analysis.experiment) {
      return reply.status(404).send({
        success: false,
        error: 'Experiment not found',
      });
    }

    // Convert Map to object for JSON
    const results = Object.fromEntries(analysis.experiment.results);

    return reply.send({
      success: true,
      data: {
        experiment: {
          ...analysis.experiment,
          results,
        },
        analysis: {
          variantAnalysis: analysis.variantAnalysis,
          winner: analysis.winner,
          isSignificant: analysis.isSignificant,
          pValue: analysis.pValue,
          meetsMinSample: analysis.meetsMinSample,
          recommendation: analysis.recommendation,
        },
      },
    });
  });

  /**
   * POST /api/admin/experiments/:experimentId/start
   * Start experiment
   */
  app.post('/api/admin/experiments/:experimentId/start', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const abEngine = getABTestEngine();

    try {
      const success = abEngine.startExperiment(experimentId);
      if (!success) {
        return reply.status(400).send({
          success: false,
          error: 'Could not start experiment',
        });
      }

      return reply.send({
        success: true,
        message: 'Experiment started',
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * POST /api/admin/experiments/:experimentId/pause
   * Pause experiment
   */
  app.post('/api/admin/experiments/:experimentId/pause', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const abEngine = getABTestEngine();

    const success = abEngine.pauseExperiment(experimentId);
    if (!success) {
      return reply.status(400).send({
        success: false,
        error: 'Could not pause experiment',
      });
    }

    return reply.send({
      success: true,
      message: 'Experiment paused',
    });
  });

  /**
   * POST /api/admin/experiments/:experimentId/complete
   * Complete experiment
   */
  app.post('/api/admin/experiments/:experimentId/complete', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { experimentId } = request.params as { experimentId: string };
    const body = request.body as { winner?: string } | undefined;
    const abEngine = getABTestEngine();

    const success = abEngine.completeExperiment(experimentId, body?.winner);
    if (!success) {
      return reply.status(400).send({
        success: false,
        error: 'Could not complete experiment',
      });
    }

    const analysis = abEngine.analyzeExperiment(experimentId);

    return reply.send({
      success: true,
      message: 'Experiment completed',
      winner: analysis.winner,
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // KB Health & Gaps
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/kb/health
   * KB health overview
   */
  const getGapSeverity = (priority: number) => {
    if (priority >= 8) return 'critical';
    if (priority >= 5) return 'high';
    if (priority >= 2) return 'medium';
    return 'low';
  };

  app.get('/api/admin/kb/health', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const gaps = await feedbackLoop.detectKnowledgeGaps();
    const improvements = await feedbackLoop.autoGenerateFAQ();

    // Categorize gaps by severity
    const critical = gaps.filter((g: { priority: number }) => getGapSeverity(g.priority) === 'critical');
    const high = gaps.filter((g: { priority: number }) => getGapSeverity(g.priority) === 'high');
    const medium = gaps.filter((g: { priority: number }) => getGapSeverity(g.priority) === 'medium');
    const low = gaps.filter((g: { priority: number }) => getGapSeverity(g.priority) === 'low');

    // Calculate health score
    const totalWeight = critical.length * 4 + high.length * 3 + medium.length * 2 + low.length;
    const maxWeight = gaps.length * 4;
    const healthScore = maxWeight > 0 ? Math.max(0, 100 - (totalWeight / maxWeight) * 100) : 100;

    let healthStatus: string;
    if (healthScore >= 80) { healthStatus = 'healthy'; }
    else if (healthScore >= 60) { healthStatus = 'warning'; }
    else { healthStatus = 'critical'; }

    return reply.send({
      success: true,
      data: {
        healthScore: healthScore.toFixed(1),
        status: healthStatus,
        gaps: {
          total: gaps.length,
          bySeverity: {
            critical: critical.length,
            high: high.length,
            medium: medium.length,
            low: low.length,
          },
          topGaps: gaps.slice(0, 10),
        },
        improvements: {
          total: improvements.length,
          byType: {
            addContent: 0,
            updateContent: 0,
            addFaq: improvements.filter((i: { type: string }) => i.type === 'auto_faq').length,
          },
          suggestions: improvements.slice(0, 10),
        },
      },
    });
  });

  /**
   * GET /api/admin/kb/gaps
   * Detailed gap analysis
   */
  app.get('/api/admin/kb/gaps', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as PaginationQuery & { severity?: string };
    
    const allGaps = await feedbackLoop.detectKnowledgeGaps();

    // Filter by severity
    let gaps = allGaps;
    if (query.severity) {
      gaps = allGaps.filter((g: { priority: number }) => getGapSeverity(g.priority) === query.severity);
    }

    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;
    const paginatedGaps = gaps.slice(offset, offset + limit);

    return reply.send({
      success: true,
      data: {
        gaps: paginatedGaps,
        pagination: {
          page,
          limit,
          total: gaps.length,
          pages: Math.ceil(gaps.length / limit),
        },
      },
    });
  });

  /**
   * GET /api/admin/kb/auto-faqs
   * Get auto-generated FAQs
   */
  app.get('/api/admin/kb/auto-faqs', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const faqs = await feedbackLoop.autoGenerateFAQ();

    return reply.send({
      success: true,
      data: {
        faqs: faqs.slice(0, 20),
        generatedAt: new Date().toISOString(),
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Feedback Analytics
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/feedback/stats
   * Feedback statistics
   */
  app.get('/api/admin/feedback/stats', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const summary = feedbackLoop.getAnalyticsSummary();
    const interactions = feedbackLoop.getStore().getRecentInteractions(100);

    // Calculate trends
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const lastHour = interactions.filter((i: { timestamp: Date }) => i.timestamp.getTime() >= hourAgo);
    const lastDay = interactions.filter((i: { timestamp: Date }) => i.timestamp.getTime() >= dayAgo);

    const hourlyRate = lastHour.length;
    const dailyRate = lastDay.length;

    return reply.send({
      success: true,
      data: {
        summary,
        trends: {
          lastHour: hourlyRate,
          lastDay: dailyRate,
          avgPerHour: (dailyRate / 24).toFixed(1),
        },
        recentInteractions: interactions.slice(0, 20).map((i: { id: string; query: string; confidence: number; timestamp: Date }) => ({
          id: i.id,
          query: i.query.slice(0, 100),
          confidence: i.confidence,
          timestamp: i.timestamp,
        })),
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // System Monitoring
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/system/status
   * System health and status
   */
  app.get('/api/admin/system/status', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const sessionStore = getSessionStore();

    // Memory usage
    const memUsage = process.memoryUsage();

    return reply.send({
      success: true,
      data: {
        status: 'operational',
        uptime: Math.floor(process.uptime()),
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        },
        components: {
          sessionStore: {
            status: 'active',
            sessions: sessionStore.getStats().totalSessions,
          },
          feedbackLoop: {
            status: 'active',
            interactions: feedbackLoop.getAnalyticsSummary().totalInteractions,
          },
          abTesting: {
            status: 'active',
            experiments: getABTestEngine().getSummary().total,
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  /**
   * POST /api/admin/system/cleanup
   * Trigger system cleanup
   */
  app.post('/api/admin/system/cleanup', { preHandler: [requireRole('admin')] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const sessionStore = getSessionStore();
    
    const cleanedSessions = sessionStore.cleanup();

    // Force garbage collection if available
    if (globalThis.gc) {
      globalThis.gc();
    }

    return reply.send({
      success: true,
      data: {
        cleanedSessions,
        message: 'Cleanup completed',
        timestamp: new Date().toISOString(),
      },
    });
  });
}

export default adminDashboardRoutes;
