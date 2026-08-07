function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
/**
 * Watany Alerting System
 * 
 * Phase 4: Slack and webhook notifications
 * - Alert definitions and thresholds
 * - Multiple notification channels
 * - Alert history and deduplication
 * - Escalation rules
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export type AlertType = 
  | 'kb_gap_critical'
  | 'kb_gap_high'
  | 'low_confidence'
  | 'high_error_rate'
  | 'experiment_completed'
  | 'session_spike'
  | 'system_error'
  | 'custom';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  condition: AlertCondition;
  enabled: boolean;
  cooldownMs: number;  // Minimum time between alerts
  channels: NotificationChannel[];
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  windowMs?: number;  // Time window for aggregation
}

export interface NotificationChannel {
  type: 'slack' | 'webhook' | 'email' | 'console';
  config: Record<string, string>;
  enabled: boolean;
}

export interface AlertingConfig {
  enabled: boolean;
  defaultCooldownMs: number;
  maxAlertsPerHour: number;
  retentionDays: number;
}

// ─────────────────────────────────────────────────────────────────────
// Slack Integration
// ─────────────────────────────────────────────────────────────────────

export class SlackNotifier {
  private webhookUrl: string;
  private defaultChannel?: string;
  private username: string;

  constructor(config: { webhookUrl: string; channel?: string; username?: string }) {
    this.webhookUrl = config.webhookUrl;
    this.defaultChannel = config.channel;
    this.username = config.username || 'Watany Bot';
  }

  async send(alert: Alert, channel?: string): Promise<boolean> {
    const color = this.getSeverityColor(alert.severity);
    
    const payload = {
      channel: channel || this.defaultChannel,
      username: this.username,
      icon_emoji: this.getSeverityEmoji(alert.severity),
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'النوع',
              value: alert.type,
              short: true,
            },
            {
              title: 'الخطورة',
              value: this.getSeverityLabel(alert.severity),
              short: true,
            },
            ...(alert.data ? Object.entries(alert.data).map(([key, value]) => ({
              title: key,
              value: watanySafeStringField(value),
              short: true,
            })) : []),
          ],
          footer: 'Watany Alert System',
          ts: Math.floor(alert.timestamp.getTime() / 1000).toString(),
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('[ALERT] Slack notification failed:', error);
      return false;
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'error': return '#fd7e14';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return ':rotating_light:';
      case 'error': return ':x:';
      case 'warning': return ':warning:';
      case 'info': return ':information_source:';
      default: return ':bell:';
    }
  }

  private getSeverityLabel(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return '🔴 حرج';
      case 'error': return '🟠 خطأ';
      case 'warning': return '🟡 تحذير';
      case 'info': return '🔵 معلومات';
      default: return severity;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Generic Webhook Notifier
// ─────────────────────────────────────────────────────────────────────

export class WebhookNotifier {
  private url: string;
  private headers: Record<string, string>;
  private method: 'POST' | 'PUT';

  constructor(config: { url: string; headers?: Record<string, string>; method?: 'POST' | 'PUT' }) {
    this.url = config.url;
    this.headers = config.headers || { 'Content-Type': 'application/json' };
    this.method = config.method || 'POST';
  }

  async send(alert: Alert): Promise<boolean> {
    const payload = {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      timestamp: alert.timestamp.toISOString(),
    };

    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('[ALERT] Webhook notification failed:', error);
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Console Notifier (for development)
// ─────────────────────────────────────────────────────────────────────

export class ConsoleNotifier {
  async send(alert: Alert): Promise<boolean> {
    const severityColors: Record<AlertSeverity, string> = {
      critical: '\x1b[41m\x1b[37m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      info: '\x1b[36m',
    };
    
    const reset = '\x1b[0m';
    const color = severityColors[alert.severity] || '';
    
    console.log(`\n${color}═══ ALERT: ${alert.title} ═══${reset}`);
    console.log(`Type: ${alert.type}`);
    console.log(`Severity: ${alert.severity}`);
    console.log(`Message: ${alert.message}`);
    if (alert.data) {
      console.log('Data:', JSON.stringify(alert.data, null, 2));
    }
    console.log(`Time: ${alert.timestamp.toISOString()}`);
    console.log(`${color}${'═'.repeat(50)}${reset}\n`);
    
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Alert Manager
// ─────────────────────────────────────────────────────────────────────

export class AlertManager {
  private config: AlertingConfig;
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private alertCountPerHour = 0;
  private hourStart = Date.now();
  
  private slackNotifier?: SlackNotifier;
  private webhookNotifiers: Map<string, WebhookNotifier> = new Map();
  private consoleNotifier = new ConsoleNotifier();

  constructor(config?: Partial<AlertingConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      defaultCooldownMs: config?.defaultCooldownMs || 5 * 60 * 1000, // 5 minutes
      maxAlertsPerHour: config?.maxAlertsPerHour || 100,
      retentionDays: config?.retentionDays || 30,
    };

    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // KB Gap Critical
    this.addRule({
      id: 'kb_gap_critical',
      name: 'Critical KB Gap',
      type: 'kb_gap_critical',
      condition: { metric: 'gap_severity', operator: '==', threshold: 4 }, // 4 = critical
      enabled: true,
      cooldownMs: 30 * 60 * 1000, // 30 minutes
      channels: [
        { type: 'slack', config: {}, enabled: true },
        { type: 'console', config: {}, enabled: true },
      ],
    });

    // Low Confidence Alert
    this.addRule({
      id: 'low_confidence',
      name: 'Low Confidence Response',
      type: 'low_confidence',
      condition: { metric: 'confidence', operator: '<', threshold: 0.3 },
      enabled: true,
      cooldownMs: 10 * 60 * 1000,
      channels: [
        { type: 'console', config: {}, enabled: true },
      ],
    });

    // High Error Rate
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      type: 'high_error_rate',
      condition: { metric: 'error_rate', operator: '>', threshold: 0.1, windowMs: 60 * 1000 },
      enabled: true,
      cooldownMs: 15 * 60 * 1000,
      channels: [
        { type: 'slack', config: {}, enabled: true },
        { type: 'console', config: {}, enabled: true },
      ],
    });

    // Experiment Completed
    this.addRule({
      id: 'experiment_completed',
      name: 'Experiment Completed',
      type: 'experiment_completed',
      condition: { metric: 'experiment_status', operator: '==', threshold: 1 },
      enabled: true,
      cooldownMs: 0, // No cooldown for experiments
      channels: [
        { type: 'slack', config: {}, enabled: true },
        { type: 'console', config: {}, enabled: true },
      ],
    });

    // System Error
    this.addRule({
      id: 'system_error',
      name: 'System Error',
      type: 'system_error',
      condition: { metric: 'error_count', operator: '>=', threshold: 1 },
      enabled: true,
      cooldownMs: 5 * 60 * 1000,
      channels: [
        { type: 'slack', config: {}, enabled: true },
        { type: 'webhook', config: {}, enabled: true },
        { type: 'console', config: {}, enabled: true },
      ],
    });
  }

  /**
   * Configure Slack integration
   */
  configureSlack(webhookUrl: string, channel?: string): void {
    this.slackNotifier = new SlackNotifier({
      webhookUrl,
      channel,
      username: 'Watany Alert Bot',
    });
    console.log('[ALERT] Slack notifications configured');
  }

  /**
   * Add webhook endpoint
   */
  addWebhook(id: string, url: string, headers?: Record<string, string>): void {
    this.webhookNotifiers.set(id, new WebhookNotifier({ url, headers }));
    console.log(`[ALERT] Webhook '${id}' configured`);
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * Trigger an alert
   */
  async trigger(params: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<Alert | null> {
    if (!this.config.enabled) return null;

    // Check rate limit
    if (!this.checkRateLimit()) {
      console.warn('[ALERT] Rate limit exceeded, alert suppressed');
      return null;
    }

    // Check cooldown for this alert type
    const rule = this.rules.get(params.type);
    if (rule && !this.checkCooldown(params.type, rule.cooldownMs)) {
      console.debug(`[ALERT] Alert '${params.type}' in cooldown`);
      return null;
    }

    // Create alert
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      data: params.data,
      timestamp: new Date(),
      acknowledged: false,
    };

    // Store alert
    this.alerts.push(alert);
    this.lastAlertTime.set(params.type, Date.now());
    this.alertCountPerHour++;

    // Clean old alerts
    this.cleanOldAlerts();

    // Send notifications
    await this.notify(alert, rule?.channels);

    return alert;
  }

  /**
   * Send notifications through configured channels
   */
  private async notify(alert: Alert, channels?: NotificationChannel[]): Promise<void> {
    const targetChannels = channels || [{ type: 'console' as const, config: {}, enabled: true }];

    for (const channel of targetChannels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'slack':
            if (this.slackNotifier) {
              await this.slackNotifier.send(alert, channel.config.channel);
            }
            break;

          case 'webhook':
            const webhookId = channel.config.webhookId || 'default';
            const webhook = this.webhookNotifiers.get(webhookId);
            if (webhook) {
              await webhook.send(alert);
            }
            break;

          case 'console':
            await this.consoleNotifier.send(alert);
            break;

          case 'email':
            // Email not implemented yet
            console.log('[ALERT] Email notifications not implemented');
            break;
        }
      } catch (error) {
        console.error(`[ALERT] Failed to send to ${channel.type}:`, error);
      }
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter every hour
    if (now - this.hourStart > 60 * 60 * 1000) {
      this.hourStart = now;
      this.alertCountPerHour = 0;
    }

    return this.alertCountPerHour < this.config.maxAlertsPerHour;
  }

  /**
   * Check cooldown
   */
  private checkCooldown(alertType: string, cooldownMs: number): boolean {
    const lastTime = this.lastAlertTime.get(alertType);
    if (!lastTime) return true;
    
    return Date.now() - lastTime >= cooldownMs;
  }

  /**
   * Clean old alerts
   */
  private cleanOldAlerts(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(a => a.timestamp.getTime() >= cutoff);
  }

  /**
   * Acknowledge alert
   */
  acknowledge(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    return true;
  }

  /**
   * Get alerts
   */
  getAlerts(options?: {
    type?: AlertType;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    limit?: number;
  }): Alert[] {
    let filtered = [...this.alerts];

    if (options?.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }

    if (options?.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options?.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === options.acknowledged);
    }

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get status
   */
  getStatus(): {
    enabled: boolean;
    totalAlerts: number;
    unacknowledged: number;
    alertsLastHour: number;
    rulesCount: number;
    slackConfigured: boolean;
    webhooksConfigured: number;
  } {
    return {
      enabled: this.config.enabled,
      totalAlerts: this.alerts.length,
      unacknowledged: this.alerts.filter(a => !a.acknowledged).length,
      alertsLastHour: this.alertCountPerHour,
      rulesCount: this.rules.size,
      slackConfigured: !!this.slackNotifier,
      webhooksConfigured: this.webhookNotifiers.size,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Alert Helper Functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Create KB gap alert
 */
export async function alertKbGap(
  manager: AlertManager,
  topic: string,
  frequency: number,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<void> {
  const severityMap: Record<string, AlertSeverity> = {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'critical',
  };

  await manager.trigger({
    type: severity === 'critical' ? 'kb_gap_critical' : 'kb_gap_high',
    severity: severityMap[severity],
    title: `ثغرة في قاعدة المعرفة: ${topic}`,
    message: `تم اكتشاف نقص في المحتوى حول "${topic}" بتكرار ${frequency} مرة.`,
    data: { topic, frequency, severity },
  });
}

/**
 * Create experiment completed alert
 */
export async function alertExperimentCompleted(
  manager: AlertManager,
  experimentName: string,
  winner: string,
  improvement: number
): Promise<void> {
  await manager.trigger({
    type: 'experiment_completed',
    severity: 'info',
    title: `تجربة مكتملة: ${experimentName}`,
    message: `الفائز: ${winner} بتحسن ${(improvement * 100).toFixed(1)}%`,
    data: { experimentName, winner, improvement },
  });
}

/**
 * Create system error alert
 */
export async function alertSystemError(
  manager: AlertManager,
  error: Error,
  context?: string
): Promise<void> {
  await manager.trigger({
    type: 'system_error',
    severity: 'error',
    title: 'خطأ في النظام',
    message: error.message,
    data: {
      context: context || 'unknown',
      stack: process.env.NODE_ENV !== "production" ? error["stack"]?.split('\n').slice(0, 5).join('\n') : undefined,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let alertManagerInstance: AlertManager | null = null;

export function getAlertManager(): AlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager({
      enabled: process.env.ALERTS_ENABLED !== 'false',
      defaultCooldownMs: parseInt(process.env.ALERTS_COOLDOWN_MS || '300000'),
      maxAlertsPerHour: parseInt(process.env.ALERTS_MAX_PER_HOUR || '100'),
      retentionDays: parseInt(process.env.ALERTS_RETENTION_DAYS || '30'),
    });

    // Configure Slack if URL provided
    if (process.env.SLACK_WEBHOOK_URL) {
      alertManagerInstance.configureSlack(
        process.env.SLACK_WEBHOOK_URL,
        process.env.SLACK_CHANNEL
      );
    }

    // Configure default webhook if URL provided
    if (process.env.ALERT_WEBHOOK_URL) {
      alertManagerInstance.addWebhook('default', process.env.ALERT_WEBHOOK_URL);
    }
  }
  return alertManagerInstance;
}

export function createAlertManager(config: Partial<AlertingConfig>): AlertManager {
  alertManagerInstance = new AlertManager(config);
  return alertManagerInstance;
}

