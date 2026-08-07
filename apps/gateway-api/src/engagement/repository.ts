import { randomUUID } from 'node:crypto';
import { engagementPool } from './db';
import type {
  EngagementAwardInput,
  EngagementAwardResult,
  EngagementSummary,
} from './types';

type Queryable = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

type PointRuleRow = {
  id: string;
  code: string;
  points: number;
  daily_cap: number | null;
  cooldown_seconds: number | null;
  requires_verification: boolean;
  is_active: boolean;
};

function stableIdempotencyKey(input: EngagementAwardInput): string {
  const sourceId = input.sourceId ?? 'none';
  return [
    'engagement',
    input.userId,
    input.ruleCode,
    input.sourceType,
    sourceId,
  ].join(':');
}

export class EngagementRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = engagementPool as unknown as Queryable) {
    this.db = db;
  }

  async awardPoints(input: EngagementAwardInput): Promise<EngagementAwardResult> {
    const ruleResult = await this.db.query(
      `SELECT
         id,
         code,
         points,
         daily_cap,
         cooldown_seconds,
         requires_verification,
         is_active
       FROM engagement_point_rules
       WHERE code = $1
       LIMIT 1`,
      [input.ruleCode],
    );

    const rule = ruleResult.rows[0] as PointRuleRow | undefined;

    if (!rule) {
      return { awarded: false, points: 0, reason: 'rule_not_found' };
    }

    if (!rule.is_active) {
      return { awarded: false, points: 0, reason: 'rule_inactive' };
    }

    if (rule.requires_verification && input.verificationApproved !== true) {
      return { awarded: false, points: 0, reason: 'verification_required' };
    }

    const idempotencyKey = stableIdempotencyKey(input);

    const duplicateResult = await this.db.query(
      `SELECT id
       FROM engagement_point_transactions
       WHERE idempotency_key = $1
       LIMIT 1`,
      [idempotencyKey],
    );

    if (duplicateResult.rowCount && duplicateResult.rowCount > 0) {
      return { awarded: false, points: 0, reason: 'duplicate' };
    }

    if (rule.daily_cap !== null) {
      const capResult = await this.db.query(
        `SELECT COALESCE(SUM(points), 0)::integer AS awarded_today
         FROM engagement_point_transactions
         WHERE user_id = $1
           AND rule_id = $2
           AND reversed_at IS NULL
           AND created_at >= date_trunc('day', NOW())`,
        [input.userId, rule.id],
      );

      const awardedToday = Number(capResult.rows[0]?.awarded_today ?? 0);
      if (awardedToday + rule.points > rule.daily_cap) {
        return { awarded: false, points: 0, reason: 'daily_cap_reached' };
      }
    }

    if (rule.cooldown_seconds !== null && rule.cooldown_seconds > 0) {
      const cooldownResult = await this.db.query(
        `SELECT created_at
         FROM engagement_point_transactions
         WHERE user_id = $1
           AND rule_id = $2
           AND reversed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [input.userId, rule.id],
      );

      const lastCreatedAt = cooldownResult.rows[0]?.created_at;
      if (lastCreatedAt) {
        const elapsedSeconds =
          (Date.now() - new Date(String(lastCreatedAt)).getTime()) / 1000;

        if (elapsedSeconds < rule.cooldown_seconds) {
          return { awarded: false, points: 0, reason: 'cooldown_active' };
        }
      }
    }

    const transactionId = randomUUID();

    try {
      await this.db.query(
        `INSERT INTO engagement_point_transactions (
           id,
           user_id,
           rule_id,
           source_type,
           source_id,
           idempotency_key,
           points,
           reason_ar,
           metadata,
           created_by_user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
        [
          transactionId,
          input.userId,
          rule.id,
          input.sourceType,
          input.sourceId ?? null,
          idempotencyKey,
          rule.points,
          input.reasonAr,
          JSON.stringify(input.metadata ?? {}),
          input.actorUserId ?? input.userId,
        ],
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        return { awarded: false, points: 0, reason: 'duplicate' };
      }
      throw error;
    }

    await this.db.query(
      `INSERT INTO engagement_audit_log (
         id,
         actor_user_id,
         action,
         entity_type,
         entity_id,
         after_state
       )
       VALUES ($1, $2, 'POINTS_AWARDED', 'engagement_point_transaction', $3, $4::jsonb)`,
      [
        randomUUID(),
        input.actorUserId ?? input.userId,
        transactionId,
        JSON.stringify({
          userId: input.userId,
          ruleCode: input.ruleCode,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          points: rule.points,
        }),
      ],
    );

    return {
      awarded: true,
      transactionId,
      points: rule.points,
      reason: 'awarded',
    };
  }

  async getSummary(userId: string): Promise<EngagementSummary> {
    const totalsResult = await this.db.query(
      `SELECT
         COALESCE((
           SELECT SUM(points)
           FROM engagement_point_transactions
           WHERE user_id = $1
             AND reversed_at IS NULL
         ), 0)::integer AS points,
         COALESCE((
           SELECT SUM(reputation_delta)
           FROM engagement_reputation_transactions
           WHERE user_id = $1
             AND reversed_at IS NULL
         ), 0)::integer AS reputation`,
      [userId],
    );

    const points = Number(totalsResult.rows[0]?.points ?? 0);
    const reputation = Number(totalsResult.rows[0]?.reputation ?? 0);

    const levelsResult = await this.db.query(
      `SELECT code, title_ar, title_en, minimum_points
       FROM engagement_levels
       WHERE is_active = TRUE
       ORDER BY minimum_points ASC`,
    );

    const levels = levelsResult.rows.map((row) => ({
      code: String(row.code),
      titleAr: String(row.title_ar),
      titleEn: row.title_en ? String(row.title_en) : null,
      minimumPoints: Number(row.minimum_points),
    }));

    const currentLevel =
      [...levels].reverse().find((level) => points >= level.minimumPoints) ??
      levels[0] ?? {
        code: 'member',
        titleAr: 'عضو',
        titleEn: 'Member',
        minimumPoints: 0,
      };

    const nextLevel =
      levels.find((level) => level.minimumPoints > points) ?? null;

    const badgesResult = await this.db.query(
      `SELECT
         badge.code,
         badge.title_ar,
         badge.description_ar,
         badge.icon_name,
         user_badge.awarded_at
       FROM engagement_user_badges user_badge
       INNER JOIN engagement_badges badge
         ON badge.id = user_badge.badge_id
       WHERE user_badge.user_id = $1
         AND user_badge.revoked_at IS NULL
         AND badge.is_active = TRUE
       ORDER BY user_badge.awarded_at DESC`,
      [userId],
    );

    return {
      points,
      reputation,
      level: currentLevel,
      nextLevel: nextLevel
        ? {
            ...nextLevel,
            pointsRemaining: Math.max(0, nextLevel.minimumPoints - points),
          }
        : null,
      badges: badgesResult.rows.map((row) => ({
        code: String(row.code),
        titleAr: String(row.title_ar),
        descriptionAr: row.description_ar
          ? String(row.description_ar)
          : null,
        iconName: row.icon_name ? String(row.icon_name) : null,
        awardedAt: new Date(String(row.awarded_at)).toISOString(),
      })),
    };
  }

  async listLevels(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `SELECT
         code,
         title_ar AS "titleAr",
         title_en AS "titleEn",
         minimum_points AS "minimumPoints",
         sort_order AS "sortOrder"
       FROM engagement_levels
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`,
    );

    return result.rows;
  }

  async listRules(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `SELECT
         code,
         title_ar AS "titleAr",
         title_en AS "titleEn",
         category,
         points,
         daily_cap AS "dailyCap",
         cooldown_seconds AS "cooldownSeconds",
         requires_verification AS "requiresVerification",
         is_active AS "isActive"
       FROM engagement_point_rules
       ORDER BY category, code`,
    );

    return result.rows;
  }

  async reversePointTransaction(input: {
    transactionId: string;
    actorUserId: string;
    reason: string;
  }): Promise<boolean> {
    const beforeResult = await this.db.query(
      `SELECT *
       FROM engagement_point_transactions
       WHERE id = $1
         AND reversed_at IS NULL
       LIMIT 1`,
      [input.transactionId],
    );

    const before = beforeResult.rows[0];
    if (!before) {
      return false;
    }

    await this.db.query(
      `UPDATE engagement_point_transactions
       SET
         reversed_at = NOW(),
         reversed_by_user_id = $2,
         reversal_reason = $3
       WHERE id = $1
         AND reversed_at IS NULL`,
      [input.transactionId, input.actorUserId, input.reason],
    );

    await this.db.query(
      `INSERT INTO engagement_audit_log (
         id,
         actor_user_id,
         action,
         entity_type,
         entity_id,
         before_state,
         after_state
       )
       VALUES ($1, $2, 'POINT_TRANSACTION_REVERSED', 'engagement_point_transaction', $3, $4::jsonb, $5::jsonb)`,
      [
        randomUUID(),
        input.actorUserId,
        input.transactionId,
        JSON.stringify(before),
        JSON.stringify({
          reversedAt: new Date().toISOString(),
          reason: input.reason,
        }),
      ],
    );

    return true;
  }
}