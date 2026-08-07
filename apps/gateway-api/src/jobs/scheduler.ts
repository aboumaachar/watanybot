/**
 * Watany Scheduled Jobs (Cron)
 * 
 * Phase 4: Scheduled maintenance and optimization tasks
 * - Session cleanup
 * - KB gap analysis
 * - A/B test auto-completion
 * - Analytics aggregation
 * - Data persistence sync
 */

import { getSessionStore } from '../ai/session-tracking';
import { getABTestEngine } from '../ai/ab-testing';
import { feedbackLoop } from '../ai/feedback-loop';
import { getPersistenceManager } from '../db/persistence';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  handler: () => Promise<JobResult>;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: JobResult;
  nextRun?: Date;
}

export interface JobResult {
  success: boolean;
  message: string;
  duration: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface JobConfig {
  enableSessionCleanup: boolean;
  enableKbAnalysis: boolean;
  enableAbAutoComplete: boolean;
  enableAnalyticsAggregation: boolean;
  enableDataSync: boolean;
  cleanupIntervalMs: number;
  analysisIntervalMs: number;
  syncIntervalMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// Simple Cron Expression Parser
// ─────────────────────────────────────────────────────────────────────

interface CronSchedule {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  const values: number[] = [];
  const parts = field.split(',');

  for (const part of parts) {
    if (part.includes('/')) {
      // Step values: */5 or 1-10/2
      const [range, step] = part.split('/');
      const stepNum = parseInt(step);
      let start = min;
      let end = max;

      if (range !== '*') {
        if (range.includes('-')) {
          [start, end] = range.split('-').map(Number);
        } else {
          start = parseInt(range);
        }
      }

      for (let i = start; i <= end; i += stepNum) {
        values.push(i);
      }
    } else if (part.includes('-')) {
      // Range: 1-5
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
    } else {
      // Single value
      values.push(parseInt(part));
    }
  }

  return values.filter(v => v >= min && v <= max);
}

function parseCronExpression(expression: string): CronSchedule {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

function matchesCronSchedule(date: Date, schedule: CronSchedule): boolean {
  return (
    schedule.minute.includes(date.getMinutes()) &&
    schedule.hour.includes(date.getHours()) &&
    schedule.dayOfMonth.includes(date.getDate()) &&
    schedule.month.includes(date.getMonth() + 1) &&
    schedule.dayOfWeek.includes(date.getDay())
  );
}

function getNextRunTime(schedule: CronSchedule, after: Date = new Date()): Date {
  const next = new Date(after);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  // Search up to 1 year
  const maxDate = new Date(after);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  while (next < maxDate) {
    if (matchesCronSchedule(next, schedule)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return maxDate;
}

// ─────────────────────────────────────────────────────────────────────
// Job Handlers
// ─────────────────────────────────────────────────────────────────────

/**
 * Session cleanup job
 */
async function sessionCleanupHandler(): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const sessionStore = getSessionStore();
    const cleaned = sessionStore.cleanup();
    const stats = sessionStore.getStats();

    return {
      success: true,
      message: `Cleaned ${cleaned} expired sessions`,
      duration: Date.now() - startTime,
      data: {
        cleaned,
        remaining: stats.totalSessions,
        active: stats.activeSessions,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Session cleanup failed',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * KB gap analysis job
 */
async function kbAnalysisHandler(): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const gaps = await feedbackLoop.detectKnowledgeGaps();
    const autoFaqs = await feedbackLoop.autoGenerateFAQ();

    // Helper to determine severity from priority
    const getSeverity = (priority: number) => {
      if (priority >= 8) return 'critical';
      if (priority >= 5) return 'high';
      if (priority >= 2) return 'medium';
      return 'low';
    };

    // Persist gaps to database if available
    const persistence = getPersistenceManager();
    
    for (const gap of gaps.slice(0, 20)) {
      try {
        await persistence.getClient().query(
          `INSERT INTO watany_kb_gaps (topic, sample_queries, frequency, avg_confidence, severity)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (topic) DO UPDATE SET
             frequency = watany_kb_gaps.frequency + 1,
             sample_queries = $2,
             avg_confidence = $4,
             updated_at = NOW()`,
          [gap.query, JSON.stringify([gap.query]), gap.frequency, gap.avgConfidence, getSeverity(gap.priority)]
        );
      } catch {
        // Ignore DB errors for in-memory mode
      }
    }

    return {
      success: true,
      message: `Analyzed KB: ${gaps.length} gaps, ${autoFaqs.length} improvements`,
      duration: Date.now() - startTime,
      data: {
        gapsFound: gaps.length,
        improvementsSuggested: autoFaqs.length,
        autoFaqsGenerated: autoFaqs.length,
        criticalGaps: gaps.filter((g: { priority: number }) => getSeverity(g.priority) === 'critical').length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'KB analysis failed',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * A/B test auto-completion job
 */
async function abAutoCompleteHandler(): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const abEngine = getABTestEngine();
    const runningExperiments = abEngine.listExperiments('running');
    let completed = 0;

    for (const exp of runningExperiments) {
      const analysis = abEngine.analyzeExperiment(exp.id);
      
      // Auto-complete if significant and meets sample
      if (analysis.isSignificant && analysis.meetsMinSample) {
        abEngine.completeExperiment(exp.id, analysis.winner || undefined);
        completed++;
      }
    }

    return {
      success: true,
      message: `Checked ${runningExperiments.length} experiments, completed ${completed}`,
      duration: Date.now() - startTime,
      data: {
        checked: runningExperiments.length,
        completed,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'A/B auto-complete failed',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Analytics aggregation job
 */
async function analyticsAggregationHandler(): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const summary = feedbackLoop.getAnalyticsSummary();
    const sessionStore = getSessionStore();
    const sessionStats = sessionStore.getStats();

    // Log aggregated metrics
    const persistence = getPersistenceManager();
    
    try {
      await persistence.logEvent('daily_aggregation', {
        interactions: summary.totalInteractions,
        avgConfidence: summary.avgConfidence,
        positiveRate: summary.feedbackStats.positiveRate,
        sessions: sessionStats.totalSessions,
        activeSessions: sessionStats.activeSessions,
        avgTurnCount: sessionStats.avgTurnCount,
      });
    } catch {
      // Ignore DB errors
    }

    return {
      success: true,
      message: 'Analytics aggregation complete',
      duration: Date.now() - startTime,
      data: {
        totalInteractions: summary.totalInteractions,
        avgConfidence: summary.avgConfidence,
        positiveRate: summary.feedbackStats.positiveRate,
        totalSessions: sessionStats.totalSessions,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Analytics aggregation failed',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Data sync job (persist in-memory data to DB)
 */
async function dataSyncHandler(): Promise<JobResult> {
  const startTime = Date.now();
  
  try {
    const persistence = getPersistenceManager();
    const sessionStore = getSessionStore();
    const abEngine = getABTestEngine();
    
    let sessionsSynced = 0;
    let experimentsSynced = 0;

    // Sync sessions
    const sessions = sessionStore.export();
    for (const session of sessions) {
      try {
        await persistence.saveSession({
          id: session.id,
          userId: session.userId,
          channel: session.channel,
          state: session.state,
          context: session.context,
          analytics: session.analytics,
          expiresAt: session.expiresAt,
        });
        sessionsSynced++;
      } catch {
        // Continue on error
      }
    }

    // Sync experiments
    const expData = abEngine.export();
    for (const exp of expData.experiments) {
      try {
        await persistence.saveExperiment({
          id: exp.id,
          name: exp.name,
          description: exp.description,
          hypothesis: exp.hypothesis,
          status: exp.status,
          targetMetric: exp.targetMetric,
          minimumSampleSize: exp.minimumSampleSize,
          significanceLevel: exp.significanceLevel,
          variants: exp.variants,
          results: Object.fromEntries(exp.results),
          winner: exp.winner,
          startedAt: exp.startedAt,
          completedAt: exp.completedAt,
        });
        experimentsSynced++;
      } catch {
        // Continue on error
      }
    }

    // Sync interactions
    const interactions = feedbackLoop.getStore().getRecentInteractions(100);
    let interactionsSynced = 0;
    
    for (const interaction of interactions) {
      try {
        await persistence.saveInteraction({
          id: interaction.id,
          sessionId: interaction.id, // Using id as sessionId placeholder
          userId: interaction.userId,
          query: interaction.query,
          response: interaction.answer,
          intent: interaction.queryUnderstanding?.primaryIntent,
          entities: interaction.queryUnderstanding?.entities || {},
          chunksUsed: interaction.sources?.map((s: { id: string }) => s.id) || [],
          confidence: interaction.confidence,
          processingTimeMs: interaction.responseTimeMs,
          rating: undefined,
          feedbackText: undefined,
        });
        interactionsSynced++;
      } catch {
        // Continue on error
      }
    }

    return {
      success: true,
      message: `Synced data to database`,
      duration: Date.now() - startTime,
      data: {
        sessionsSynced,
        experimentsSynced,
        interactionsSynced,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Data sync failed',
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Job Scheduler
// ─────────────────────────────────────────────────────────────────────

export class JobScheduler {
  private jobs: Map<string, Job> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;
  private config: JobConfig;

  constructor(config?: Partial<JobConfig>) {
    this.config = {
      enableSessionCleanup: config?.enableSessionCleanup ?? true,
      enableKbAnalysis: config?.enableKbAnalysis ?? true,
      enableAbAutoComplete: config?.enableAbAutoComplete ?? true,
      enableAnalyticsAggregation: config?.enableAnalyticsAggregation ?? true,
      enableDataSync: config?.enableDataSync ?? true,
      cleanupIntervalMs: config?.cleanupIntervalMs || 5 * 60 * 1000, // 5 minutes
      analysisIntervalMs: config?.analysisIntervalMs || 60 * 60 * 1000, // 1 hour
      syncIntervalMs: config?.syncIntervalMs || 10 * 60 * 1000, // 10 minutes
    };

    this.registerDefaultJobs();
  }

  /**
   * Register default jobs
   */
  private registerDefaultJobs(): void {
    // Session cleanup - every 5 minutes
    if (this.config.enableSessionCleanup) {
      this.register({
        id: 'session_cleanup',
        name: 'Session Cleanup',
        description: 'Clean up expired and idle sessions',
        cronExpression: '*/5 * * * *',
        handler: sessionCleanupHandler,
        enabled: true,
      });
    }

    // KB analysis - every hour
    if (this.config.enableKbAnalysis) {
      this.register({
        id: 'kb_analysis',
        name: 'KB Gap Analysis',
        description: 'Analyze knowledge base gaps and suggest improvements',
        cronExpression: '0 * * * *',
        handler: kbAnalysisHandler,
        enabled: true,
      });
    }

    // A/B auto-complete - every 15 minutes
    if (this.config.enableAbAutoComplete) {
      this.register({
        id: 'ab_auto_complete',
        name: 'A/B Test Auto-Complete',
        description: 'Automatically complete experiments when significant',
        cronExpression: '*/15 * * * *',
        handler: abAutoCompleteHandler,
        enabled: true,
      });
    }

    // Analytics aggregation - every 6 hours
    if (this.config.enableAnalyticsAggregation) {
      this.register({
        id: 'analytics_aggregation',
        name: 'Analytics Aggregation',
        description: 'Aggregate and persist analytics data',
        cronExpression: '0 */6 * * *',
        handler: analyticsAggregationHandler,
        enabled: true,
      });
    }

    // Data sync - every 10 minutes
    if (this.config.enableDataSync) {
      this.register({
        id: 'data_sync',
        name: 'Data Persistence Sync',
        description: 'Sync in-memory data to database',
        cronExpression: '*/10 * * * *',
        handler: dataSyncHandler,
        enabled: true,
      });
    }
  }

  /**
   * Register a job
   */
  register(job: Omit<Job, 'lastRun' | 'lastResult' | 'nextRun'>): void {
    const schedule = parseCronExpression(job.cronExpression);
    
    const fullJob: Job = {
      ...job,
      nextRun: getNextRunTime(schedule),
    };

    this.jobs.set(job.id, fullJob);
    console.log(`[CRON] Registered job: ${job.name} (${job.cronExpression})`);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    console.log('[CRON] Starting job scheduler');

    // Use interval-based scheduling for simplicity
    for (const [id, job] of this.jobs) {
      if (!job.enabled) continue;

      const schedule = parseCronExpression(job.cronExpression);
      
      // Check every minute if job should run
      const interval = setInterval(async () => {
        const now = new Date();
        if (matchesCronSchedule(now, schedule)) {
          await this.runJob(id);
        }
      }, 60 * 1000);

      this.intervals.set(id, interval);
    }

    // Run initial jobs that should run now
    this.runDueJobs();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    console.log('[CRON] Stopping job scheduler');

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  /**
   * Run a specific job
   */
  async runJob(jobId: string): Promise<JobResult | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    console.log(`[CRON] Running job: ${job.name}`);
    
    try {
      const result = await job.handler();
      job.lastRun = new Date();
      job.lastResult = result;
      job.nextRun = getNextRunTime(parseCronExpression(job.cronExpression));

      console.log(`[CRON] Job ${job.name}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message} (${result.duration}ms)`);
      
      return result;
    } catch (error) {
      const result: JobResult = {
        success: false,
        message: 'Job execution error',
        duration: 0,
        error: (error as Error).message,
      };
      
      job.lastRun = new Date();
      job.lastResult = result;
      
      console.error(`[CRON] Job ${job.name} failed:`, error);
      return result;
    }
  }

  /**
   * Run all due jobs
   */
  private async runDueJobs(): Promise<void> {
    const now = new Date();
    
    for (const [id, job] of this.jobs) {
      if (!job.enabled) continue;
      
      const schedule = parseCronExpression(job.cronExpression);
      if (matchesCronSchedule(now, schedule)) {
        await this.runJob(id);
      }
    }
  }

  /**
   * Get all jobs
   */
  getJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Enable/disable job
   */
  setJobEnabled(jobId: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    job.enabled = enabled;
    return true;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    jobs: Array<{
      id: string;
      name: string;
      enabled: boolean;
      lastRun?: Date;
      nextRun?: Date;
      lastSuccess?: boolean;
    }>;
  } {
    return {
      running: this.running,
      jobs: Array.from(this.jobs.values()).map(job => ({
        id: job.id,
        name: job.name,
        enabled: job.enabled,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        lastSuccess: job.lastResult?.success,
      })),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let schedulerInstance: JobScheduler | null = null;

export function getJobScheduler(): JobScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new JobScheduler({
      enableSessionCleanup: process.env.CRON_SESSION_CLEANUP !== 'false',
      enableKbAnalysis: process.env.CRON_KB_ANALYSIS !== 'false',
      enableAbAutoComplete: process.env.CRON_AB_AUTO_COMPLETE !== 'false',
      enableAnalyticsAggregation: process.env.CRON_ANALYTICS !== 'false',
      enableDataSync: process.env.CRON_DATA_SYNC !== 'false',
    });
  }
  return schedulerInstance;
}

export function createJobScheduler(config: Partial<JobConfig>): JobScheduler {
  schedulerInstance = new JobScheduler(config);
  return schedulerInstance;
}
