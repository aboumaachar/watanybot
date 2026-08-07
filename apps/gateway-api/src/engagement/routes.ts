import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { engagementService } from './service';

type AuthenticatedUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?: string;
  roles?: string[];
};

function getUser(request: FastifyRequest): AuthenticatedUser | null {
  return (
    (request as FastifyRequest & { user?: AuthenticatedUser }).user ?? null
  );
}

function getUserId(request: FastifyRequest): string | null {
  const user = getUser(request);
  const value = user?.id ?? user?.userId ?? user?.sub;
  return value ? String(value) : null;
}

function isAdmin(request: FastifyRequest): boolean {
  const user = getUser(request);
  if (!user) {
    return false;
  }

  const roles = new Set<string>(
    [
      ...(Array.isArray(user.roles) ? user.roles : []),
      ...(user.role ? [user.role] : []),
    ].map((role) => String(role).toLowerCase()),
  );

  return roles.has('admin') || roles.has('superadmin');
}

function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const userId = getUserId(request);

  if (!userId) {
    void reply.code(401).send({
      error: 'AUTHENTICATION_REQUIRED',
      messageAr: 'يجب تسجيل الدخول للوصول إلى رصيد المشاركة.',
    });
    return null;
  }

  return userId;
}

function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const userId = requireUser(request, reply);

  if (!userId) {
    return null;
  }

  if (!isAdmin(request)) {
    void reply.code(403).send({
      error: 'ADMIN_PERMISSION_REQUIRED',
      messageAr: 'هذه العملية متاحة للإدارة فقط.',
    });
    return null;
  }

  return userId;
}

export const engagementRoutes: FastifyPluginAsync = async (app) => {
  app.get('/levels', async (_request, reply) => {
    return reply.send({
      levels: await engagementService.listLevels(),
    });
  });

  app.get('/me', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) {
      return;
    }

    return reply.send(await engagementService.getSummary(userId));
  });

  app.get('/admin/rules', async (request, reply) => {
    if (!requireAdmin(request, reply)) {
      return;
    }

    return reply.send({
      rules: await engagementService.listRules(),
    });
  });

  app.post('/admin/manual-award', async (request, reply) => {
    const actorUserId = requireAdmin(request, reply);
    if (!actorUserId) {
      return;
    }

    const body = request.body as Record<string, unknown>;
    const userId =
      typeof body.userId === 'string' ? body.userId.trim() : '';
    const ruleCode =
      typeof body.ruleCode === 'string' ? body.ruleCode.trim() : '';
    const reasonAr =
      typeof body.reasonAr === 'string' ? body.reasonAr.trim() : '';

    if (!userId || !ruleCode || !reasonAr) {
      return reply.code(400).send({
        error: 'INVALID_MANUAL_AWARD',
        messageAr: 'معرّف المستخدم وقاعدة النقاط والسبب مطلوبة.',
      });
    }

    const result = await engagementService.awardPoints({
      userId,
      ruleCode,
      sourceType: 'admin_manual_award',
      sourceId:
        typeof body.sourceId === 'string'
          ? body.sourceId
          : `${actorUserId}:${Date.now()}`,
      reasonAr,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : {},
      actorUserId,
      verificationApproved: true,
    });

    return reply.code(result.awarded ? 201 : 409).send(result);
  });

  app.post('/admin/reverse', async (request, reply) => {
    const actorUserId = requireAdmin(request, reply);
    if (!actorUserId) {
      return;
    }

    const body = request.body as Record<string, unknown>;
    const transactionId =
      typeof body.transactionId === 'string'
        ? body.transactionId.trim()
        : '';
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!transactionId || !reason) {
      return reply.code(400).send({
        error: 'INVALID_REVERSAL',
        messageAr: 'معرّف الحركة وسبب الإلغاء مطلوبان.',
      });
    }

    const reversed = await engagementService.reversePointTransaction({
      transactionId,
      actorUserId,
      reason,
    });

    if (!reversed) {
      return reply.code(404).send({
        error: 'ACTIVE_TRANSACTION_NOT_FOUND',
      });
    }

    return reply.send({ reversed: true });
  });
};