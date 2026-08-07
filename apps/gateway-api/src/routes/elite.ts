/**
 * Elite Features API Routes
 * User profiling, feedback, and analytics endpoints
 * Based on WATANYBOT_ELITE_VISION.md specification
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// In-memory storage (replace with database in production)
const userProfiles: Map<string, any> = new Map();
const feedbackStore: any[] = [];
const interactionStore: any[] = [];

export async function eliteRoutes(app: FastifyInstance) {
  const prefix = "/api/elite";

  /**
   * POST /api/elite/profile
   * Create or update user profile
   */
  app.post(`${prefix}/profile`, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const userId = body.userId;

    if (!userId) {
      return reply.code(400).send({ ok: false, error: "userId is required" });
    }

    const existingProfile = userProfiles.get(userId);
    const updatedProfile = {
      ...existingProfile,
      ...body,
      updatedAt: Date.now(),
    };

    if (!existingProfile) {
      updatedProfile.createdAt = Date.now();
    }

    userProfiles.set(userId, updatedProfile);

    return reply.send({ ok: true, profile: updatedProfile });
  });

  /**
   * GET /api/elite/profile/:userId
   * Get user profile
   */
  app.get(`${prefix}/profile/:userId`, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };
    const profile = userProfiles.get(userId);

    if (!profile) {
      return reply.code(404).send({ ok: false, error: "Profile not found" });
    }

    return reply.send({ ok: true, profile });
  });

  /**
   * POST /api/elite/feedback
   * Submit feedback for a message
   */
  app.post(`${prefix}/feedback`, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const { messageId, feedback, comment, userId } = body;

    if (!messageId || !feedback) {
      return reply.code(400).send({ ok: false, error: "messageId and feedback are required" });
    }

    const feedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      messageId,
      feedback, // 'helpful' | 'not_helpful'
      comment: comment || null,
      userId: userId || null,
      timestamp: Date.now(),
    };

    feedbackStore.push(feedbackEntry);

    // Keep only last 10000 entries
    if (feedbackStore.length > 10000) {
      feedbackStore.splice(0, feedbackStore.length - 10000);
    }

    app.log.info({ feedbackEntry }, "Feedback received");

    return reply.send({ ok: true, feedbackId: feedbackEntry.id });
  });

  /**
   * GET /api/elite/feedback/stats
   * Get feedback statistics
   */
  app.get(`${prefix}/feedback/stats`, async (_req: FastifyRequest, reply: FastifyReply) => {
    const total = feedbackStore.length;
    const helpful = feedbackStore.filter(f => f.feedback === "helpful").length;
    const notHelpful = feedbackStore.filter(f => f.feedback === "not_helpful").length;
    const withComments = feedbackStore.filter(f => f.comment).length;

    return reply.send({
      ok: true,
      stats: {
        total,
        helpful,
        notHelpful,
        helpfulRate: total > 0 ? helpful / total : 0,
        withComments,
        recentFeedback: feedbackStore.slice(-10),
      },
    });
  });

  /**
   * POST /api/elite/interaction
   * Track user interaction
   */
  app.post(`${prefix}/interaction`, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const { userId, query, response, duration, sentiment, topics } = body;

    if (!userId || !query) {
      return reply.code(400).send({ ok: false, error: "userId and query are required" });
    }

    const interaction = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      query,
      response: response || null,
      duration: duration || 0,
      sentiment: sentiment || null,
      topics: topics || [],
      timestamp: Date.now(),
    };

    interactionStore.push(interaction);

    // Keep only last 10000 entries
    if (interactionStore.length > 10000) {
      interactionStore.splice(0, interactionStore.length - 10000);
    }

    return reply.send({ ok: true, interactionId: interaction.id });
  });

  /**
   * GET /api/elite/analytics
   * Get usage analytics
   */
  app.get(`${prefix}/analytics`, async (_req: FastifyRequest, reply: FastifyReply) => {
    // Calculate analytics from interaction store
    const totalInteractions = interactionStore.length;
    const uniqueUsers = new Set(interactionStore.map(i => i.userId)).size;

    // Topic frequency
    const topicCounts: Record<string, number> = {};
    interactionStore.forEach(i => {
      (i.topics || []).forEach((t: string) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Sentiment distribution
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let frustrationTotal = 0;

    interactionStore.forEach(i => {
      if (i.sentiment) {
        if (i.sentiment.polarity > 0.2) positiveCount++;
        else if (i.sentiment.polarity < -0.2) negativeCount++;
        else neutralCount++;
        frustrationTotal += i.sentiment.frustration || 0;
      }
    });

    const avgFrustration = interactionStore.length > 0 ? frustrationTotal / interactionStore.length : 0;

    // Recent interactions (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentCount = interactionStore.filter(i => i.timestamp > oneDayAgo).length;

    return reply.send({
      ok: true,
      analytics: {
        totalInteractions,
        uniqueUsers,
        topTopics,
        sentimentDistribution: {
          positive: positiveCount,
          negative: negativeCount,
          neutral: neutralCount,
        },
        avgFrustration,
        last24Hours: recentCount,
        feedbackStats: {
          total: feedbackStore.length,
          helpful: feedbackStore.filter(f => f.feedback === "helpful").length,
          notHelpful: feedbackStore.filter(f => f.feedback === "not_helpful").length,
        },
      },
    });
  });

  /**
   * GET /api/elite/health-resources
   * Get mental health resources
   */
  app.get(`${prefix}/health-resources`, async (_req: FastifyRequest, reply: FastifyReply) => {
    const resources = [
      {
        id: "embrace",
        name_ar: "خط دعم نفسي - Embrace",
        description_ar: "خط مساعدة نفسية مجاني وسري على مدار الساعة",
        phone: "1564",
        available: "24/7",
        type: "hotline",
      },
      {
        id: "redcross",
        name_ar: "الصليب الأحمر اللبناني",
        description_ar: "خدمات طوارئ وإسعاف",
        phone: "140",
        available: "24/7",
        type: "hotline",
      },
      {
        id: "military_hospital",
        name_ar: "المستشفى العسكري المركزي",
        description_ar: "قسم الصحة النفسية للعسكريين",
        phone: "01-XXXXXX",
        available: "أيام الأسبوع ٨-٤",
        type: "hospital",
      },
      {
        id: "veterans_support",
        name_ar: "جمعية دعم المتقاعدين العسكريين",
        description_ar: "مجموعات دعم ومساعدة اجتماعية",
        phone: "01-XXXXXX",
        available: "أيام الأسبوع",
        type: "support_group",
      },
    ];

    return reply.send({ ok: true, resources });
  });

  /**
   * POST /api/elite/crisis-report
   * Report a potential crisis (for admin alerting)
   */
  app.post(`${prefix}/crisis-report`, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const { userId, query, severity, indicators } = body;

    app.log.warn({
      type: "CRISIS_DETECTED",
      userId,
      severity,
      indicators,
      query: query?.substring(0, 100), // Truncate for logs
      timestamp: Date.now(),
    }, "Potential crisis detected");

    // In production, this could:
    // - Send alert to admin dashboard
    // - Send notification to support team
    // - Log to crisis monitoring system

    return reply.send({ ok: true, ack: true });
  });

  app.log.info("Elite features routes registered");
}
