/**
 * Watany A/B Test Automation Engine
 * 
 * Phase 3: Automated A/B testing for KB-AI optimization
 * - Experiment definition and management
 * - Statistical significance testing
 * - Automatic winner selection
 * - Feature flagging integration
 */

import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface Variant {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  weight: number; // 0-100 allocation percentage
}

export interface ExperimentMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  avgConfidence: number;
  avgResponseTime: number;
  positiveRatings: number;
  negativeRatings: number;
  satisfactionScore: number;
}

export interface VariantMetrics extends ExperimentMetrics {
  variantId: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: Variant[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived';
  targetMetric: keyof ExperimentMetrics;
  minimumSampleSize: number;
  significanceLevel: number; // e.g., 0.95 for 95% confidence
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  winner?: string;
  results: Map<string, VariantMetrics>;
}

export interface UserAssignment {
  experimentId: string;
  variantId: string;
  assignedAt: Date;
}

export interface ABTestConfig {
  defaultSignificanceLevel: number;
  defaultMinSampleSize: number;
  autoCompleteOnSignificance: boolean;
  maxRunningExperiments: number;
}

// ─────────────────────────────────────────────────────────────────────
// Statistical Functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Calculate standard error for proportion
 */
function standardError(p: number, n: number): number {
  if (n === 0) return 0;
  return Math.sqrt((p * (1 - p)) / n);
}

/**
 * Z-score for two proportions
 */
function zScoreForProportions(p1: number, n1: number, p2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;
  
  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
  
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

/**
 * Calculate p-value from z-score (two-tailed)
 */
function pValueFromZScore(z: number): number {
  // Normal CDF approximation
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  const cdf = 0.5 * (1.0 + sign * y);
  return 2 * (1 - cdf); // Two-tailed
}

/**
 * Calculate confidence interval
 */
function confidenceInterval(p: number, n: number, confidence: number): [number, number] {
  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const z = zScores[confidence] || 1.96;
  
  const se = standardError(p, n);
  return [
    Math.max(0, p - z * se),
    Math.min(1, p + z * se),
  ];
}

// ─────────────────────────────────────────────────────────────────────
// A/B Test Engine
// ─────────────────────────────────────────────────────────────────────

export class ABTestEngine {
  private experiments: Map<string, Experiment> = new Map();
  private userAssignments: Map<string, Map<string, UserAssignment>> = new Map();
  private config: ABTestConfig;

  constructor(config?: Partial<ABTestConfig>) {
    this.config = {
      defaultSignificanceLevel: config?.defaultSignificanceLevel || 0.95,
      defaultMinSampleSize: config?.defaultMinSampleSize || 100,
      autoCompleteOnSignificance: config?.autoCompleteOnSignificance ?? true,
      maxRunningExperiments: config?.maxRunningExperiments || 10,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Experiment Management
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create new experiment
   */
  createExperiment(params: {
    name: string;
    description: string;
    hypothesis: string;
    variants: Omit<Variant, 'id'>[];
    targetMetric?: keyof ExperimentMetrics;
    minimumSampleSize?: number;
    significanceLevel?: number;
  }): Experiment {
    const id = `exp_${randomUUID()}`;
    
    // Validate variant weights sum to 100
    const totalWeight = params.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }

    const variants: Variant[] = params.variants.map((v, idx) => ({
      ...v,
      id: `var_${idx}_${randomUUID().slice(0, 8)}`,
    }));

    const experiment: Experiment = {
      id,
      name: params.name,
      description: params.description,
      hypothesis: params.hypothesis,
      variants,
      status: 'draft',
      targetMetric: params.targetMetric || 'conversionRate',
      minimumSampleSize: params.minimumSampleSize || this.config.defaultMinSampleSize,
      significanceLevel: params.significanceLevel || this.config.defaultSignificanceLevel,
      createdAt: new Date(),
      results: new Map(),
    };

    // Initialize metrics for each variant
    for (const variant of variants) {
      experiment.results.set(variant.id, {
        variantId: variant.id,
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        avgConfidence: 0,
        avgResponseTime: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        satisfactionScore: 0,
      });
    }

    this.experiments.set(id, experiment);
    return experiment;
  }

  /**
   * Start experiment
   */
  startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    // Check running experiments limit
    const running = Array.from(this.experiments.values())
      .filter(e => e.status === 'running').length;
    
    if (running >= this.config.maxRunningExperiments) {
      throw new Error('Maximum running experiments reached');
    }

    experiment.status = 'running';
    experiment.startedAt = new Date();
    return true;
  }

  /**
   * Pause experiment
   */
  pauseExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return false;

    experiment.status = 'paused';
    return true;
  }

  /**
   * Complete experiment
   */
  completeExperiment(experimentId: string, winner?: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    experiment.status = 'completed';
    experiment.completedAt = new Date();
    
    if (winner) {
      experiment.winner = winner;
    } else {
      // Auto-determine winner
      const analysis = this.analyzeExperiment(experimentId);
      if (analysis.winner) {
        experiment.winner = analysis.winner;
      }
    }

    return true;
  }

  /**
   * Get experiment
   */
  getExperiment(experimentId: string): Experiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * List experiments
   */
  listExperiments(status?: Experiment['status']): Experiment[] {
    let experiments = Array.from(this.experiments.values());
    
    if (status) {
      experiments = experiments.filter(e => e.status === status);
    }

    return experiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ─────────────────────────────────────────────────────────────────
  // User Assignment
  // ─────────────────────────────────────────────────────────────────

  /**
   * Assign user to experiment variant
   */
  assignUser(userId: string, experimentId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return null;

    // Check for existing assignment
    const userExperiments = this.userAssignments.get(userId);
    if (userExperiments?.has(experimentId)) {
      const assignment = userExperiments.get(experimentId)!;
      return experiment.variants.find(v => v.id === assignment.variantId) || null;
    }

    // Random assignment based on weights
    const random = Math.random() * 100;
    let cumulative = 0;
    let selectedVariant: Variant | null = null;

    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        selectedVariant = variant;
        break;
      }
    }

    if (!selectedVariant) {
      selectedVariant = experiment.variants[experiment.variants.length - 1];
    }

    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(experimentId, {
      experimentId,
      variantId: selectedVariant.id,
      assignedAt: new Date(),
    });

    // Record impression
    const metrics = experiment.results.get(selectedVariant.id);
    if (metrics) {
      metrics.impressions++;
    }

    return selectedVariant;
  }

  /**
   * Get user's variant for experiment
   */
  getUserVariant(userId: string, experimentId: string): Variant | null {
    const userExperiments = this.userAssignments.get(userId);
    if (!userExperiments?.has(experimentId)) {
      return this.assignUser(userId, experimentId);
    }

    const assignment = userExperiments.get(experimentId)!;
    const experiment = this.experiments.get(experimentId);
    return experiment?.variants.find(v => v.id === assignment.variantId) || null;
  }

  /**
   * Get all active variants for user
   */
  getActiveVariants(userId: string): Array<{ experimentId: string; variant: Variant }> {
    const result: Array<{ experimentId: string; variant: Variant }> = [];

    for (const experiment of this.experiments.values()) {
      if (experiment.status === 'running') {
        const variant = this.getUserVariant(userId, experiment.id);
        if (variant) {
          result.push({ experimentId: experiment.id, variant });
        }
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // Metrics Recording
  // ─────────────────────────────────────────────────────────────────

  /**
   * Record conversion
   */
  recordConversion(experimentId: string, variantId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const metrics = experiment.results.get(variantId);
    if (metrics) {
      metrics.conversions++;
      metrics.conversionRate = metrics.impressions > 0 
        ? metrics.conversions / metrics.impressions 
        : 0;
    }

    // Check for auto-complete
    if (this.config.autoCompleteOnSignificance) {
      this.checkAutoComplete(experimentId);
    }
  }

  /**
   * Record response metrics
   */
  recordResponse(
    experimentId: string,
    variantId: string,
    metrics: {
      confidence?: number;
      responseTimeMs?: number;
      rating?: 'positive' | 'negative';
    }
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const variantMetrics = experiment.results.get(variantId);
    if (!variantMetrics) return;

    if (metrics.confidence !== undefined) {
      const total = variantMetrics.avgConfidence * variantMetrics.impressions + metrics.confidence;
      variantMetrics.avgConfidence = total / (variantMetrics.impressions || 1);
    }

    if (metrics.responseTimeMs !== undefined) {
      const total = variantMetrics.avgResponseTime * variantMetrics.impressions + metrics.responseTimeMs;
      variantMetrics.avgResponseTime = total / (variantMetrics.impressions || 1);
    }

    if (metrics.rating === 'positive') {
      variantMetrics.positiveRatings++;
    } else if (metrics.rating === 'negative') {
      variantMetrics.negativeRatings++;
    }

    // Update satisfaction score
    const totalRatings = variantMetrics.positiveRatings + variantMetrics.negativeRatings;
    variantMetrics.satisfactionScore = totalRatings > 0
      ? variantMetrics.positiveRatings / totalRatings
      : 0;
  }

  /**
   * Check if experiment should auto-complete
   */
  private checkAutoComplete(experimentId: string): void {
    const analysis = this.analyzeExperiment(experimentId);
    
    if (analysis.isSignificant && analysis.meetsMinSample) {
      this.completeExperiment(experimentId, analysis.winner || undefined);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Analysis
  // ─────────────────────────────────────────────────────────────────

  /**
   * Analyze experiment results
   */
  analyzeExperiment(experimentId: string): {
    experiment: Experiment | null;
    variantAnalysis: Array<{
      variantId: string;
      name: string;
      metrics: VariantMetrics;
      confidenceInterval: [number, number];
      improvementOverControl: number;
    }>;
    winner: string | null;
    isSignificant: boolean;
    pValue: number;
    meetsMinSample: boolean;
    recommendation: string;
  } {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment) {
      return {
        experiment: null,
        variantAnalysis: [],
        winner: null,
        isSignificant: false,
        pValue: 1,
        meetsMinSample: false,
        recommendation: 'Experiment not found',
      };
    }

    const variantAnalysis = experiment.variants.map(variant => {
      const metrics = experiment.results.get(variant.id)!;
      const ci = confidenceInterval(
        metrics.conversionRate,
        metrics.impressions,
        experiment.significanceLevel
      );

      return {
        variantId: variant.id,
        name: variant.name,
        metrics,
        confidenceInterval: ci,
        improvementOverControl: 0, // Will be calculated
      };
    });

    // Calculate improvement over control (first variant)
    const control = variantAnalysis[0];
    for (let i = 1; i < variantAnalysis.length; i++) {
      const treatment = variantAnalysis[i];
      if (control.metrics.conversionRate > 0) {
        treatment.improvementOverControl = 
          (treatment.metrics.conversionRate - control.metrics.conversionRate) / 
          control.metrics.conversionRate;
      }
    }

    // Statistical significance test
    let bestVariant = variantAnalysis[0];
    let isSignificant = false;
    let pValue = 1;

    for (let i = 1; i < variantAnalysis.length; i++) {
      const treatment = variantAnalysis[i];
      const targetMetric = experiment.targetMetric;

      const controlValue = control.metrics[targetMetric] as number;
      const treatmentValue = treatment.metrics[targetMetric] as number;

      if (targetMetric === 'conversionRate' || targetMetric === 'satisfactionScore') {
        // Proportion test
        const z = zScoreForProportions(
          treatmentValue,
          treatment.metrics.impressions,
          controlValue,
          control.metrics.impressions
        );
        pValue = Math.min(pValue, pValueFromZScore(z));
      }

      if (treatmentValue > bestVariant.metrics[targetMetric]) {
        bestVariant = treatment;
      }
    }

    isSignificant = pValue < (1 - experiment.significanceLevel);

    // Check minimum sample
    const meetsMinSample = variantAnalysis.every(
      v => v.metrics.impressions >= experiment.minimumSampleSize
    );

    // Determine winner
    const winner = isSignificant && meetsMinSample ? bestVariant.variantId : null;

    // Build recommendation
    let recommendation = '';
    if (!meetsMinSample) {
      const needed = Math.max(
        ...variantAnalysis.map(v => experiment.minimumSampleSize - v.metrics.impressions)
      );
      recommendation = `تحتاج إلى ${needed} زيارة إضافية للوصول للحد الأدنى`;
    } else if (!isSignificant) {
      recommendation = 'لا توجد فروق ذات دلالة إحصائية بعد. استمر في جمع البيانات.';
    } else {
      const improvementPct = (bestVariant.improvementOverControl * 100).toFixed(1);
      recommendation = `الفائز: ${bestVariant.name} بتحسن ${improvementPct}% (p=${pValue.toFixed(4)})`;
    }

    return {
      experiment,
      variantAnalysis,
      winner,
      isSignificant,
      pValue,
      meetsMinSample,
      recommendation,
    };
  }

  /**
   * Get experiment summary for dashboard
   */
  getSummary(): {
    total: number;
    running: number;
    completed: number;
    winners: Array<{ experimentName: string; winnerName: string; improvement: number }>;
  } {
    const experiments = Array.from(this.experiments.values());
    
    const winners = experiments
      .filter(e => e.status === 'completed' && e.winner)
      .map(e => {
        const winner = e.variants.find(v => v.id === e.winner);
        const analysis = this.analyzeExperiment(e.id);
        const winnerAnalysis = analysis.variantAnalysis.find(v => v.variantId === e.winner);
        
        return {
          experimentName: e.name,
          winnerName: winner?.name || 'Unknown',
          improvement: winnerAnalysis?.improvementOverControl || 0,
        };
      });

    return {
      total: experiments.length,
      running: experiments.filter(e => e.status === 'running').length,
      completed: experiments.filter(e => e.status === 'completed').length,
      winners,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Export/Import
  // ─────────────────────────────────────────────────────────────────

  /**
   * Export experiments for persistence
   */
  export(): { experiments: Experiment[]; assignments: Array<{ userId: string; assignments: UserAssignment[] }> } {
    const experiments = Array.from(this.experiments.values()).map(exp => ({
      ...exp,
      results: Array.from(exp.results.entries()) as unknown as Map<string, VariantMetrics>,
    }));

    const assignments = Array.from(this.userAssignments.entries()).map(([userId, map]) => ({
      userId,
      assignments: Array.from(map.values()),
    }));

    return { experiments, assignments };
  }

  /**
   * Import experiments from persistence
   */
  import(data: { experiments: Experiment[]; assignments: Array<{ userId: string; assignments: UserAssignment[] }> }): void {
    for (const exp of data.experiments) {
      exp.createdAt = new Date(exp.createdAt);
      if (exp.startedAt) exp.startedAt = new Date(exp.startedAt);
      if (exp.completedAt) exp.completedAt = new Date(exp.completedAt);
      
      // Reconstruct Map
      if (Array.isArray(exp.results)) {
        exp.results = new Map(exp.results as unknown as Array<[string, VariantMetrics]>);
      }
      
      this.experiments.set(exp.id, exp);
    }

    for (const userRecord of data.assignments) {
      const assignments = new Map<string, UserAssignment>();
      for (const assignment of userRecord.assignments) {
        assignment.assignedAt = new Date(assignment.assignedAt);
        assignments.set(assignment.experimentId, assignment);
      }
      this.userAssignments.set(userRecord.userId, assignments);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let abTestEngineInstance: ABTestEngine | null = null;

export function getABTestEngine(): ABTestEngine {
  if (!abTestEngineInstance) {
    abTestEngineInstance = new ABTestEngine({
      defaultSignificanceLevel: parseFloat(process.env.AB_SIGNIFICANCE_LEVEL || '0.95'),
      defaultMinSampleSize: parseInt(process.env.AB_MIN_SAMPLE_SIZE || '100'),
      autoCompleteOnSignificance: process.env.AB_AUTO_COMPLETE !== 'false',
      maxRunningExperiments: parseInt(process.env.AB_MAX_RUNNING || '10'),
    });
  }
  return abTestEngineInstance;
}

export function createABTestEngine(config: ABTestConfig): ABTestEngine {
  abTestEngineInstance = new ABTestEngine(config);
  return abTestEngineInstance;
}
