import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createSeasonalAppleJobApplication,
  exportSeasonalAppleJobApplicationsCsv,
  getSeasonalAppleJobApplication,
  listAcceptedSeasonalAppleJobApplications,
  listSeasonalAppleJobApplications,
  updateSeasonalAppleJobApplication,
} from './seasonalAppleJob.repository';

type CreateApplicationBody = Parameters<typeof createSeasonalAppleJobApplication>[0];
type UpdateApplicationBody = Parameters<typeof updateSeasonalAppleJobApplication>[1];

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function extractAdminToken(request: FastifyRequest): string {
  const directToken =
    firstHeaderValue(request.headers['x-admin-token']) ||
    firstHeaderValue(request.headers['x-koudama-admin-token']);

  if (directToken) {
    return directToken;
  }

  const authorization = firstHeaderValue(request.headers.authorization);
  const bearerPrefix = 'Bearer ';
  if (authorization.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return '';
}

async function requireSeasonalSurveyAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (request.user?.role === 'admin' || request.user?.role === 'superadmin') {
    return true;
  }

  const configuredToken = process.env.KOUDAMA_SURVEY_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || '';
  const providedToken = extractAdminToken(request);

  if (!configuredToken) {
    await reply.code(503).send({
      ok: false,
      error: 'ADMIN_GUARD_NOT_CONFIGURED',
      message: 'Admin API is disabled until KOUDAMA_SURVEY_ADMIN_TOKEN or existing admin middleware is configured.',
    });
    return false;
  }

  if (String(providedToken) !== String(configuredToken)) {
    await reply.code(403).send({ ok: false, error: 'ADMIN_FORBIDDEN' });
    return false;
  }

  return true;
}

export async function seasonalAppleJobRouter(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateApplicationBody }>(
    '/api/koudama/surveys/seasonal-apple-job/applications',
    async (request, reply) => {
      try {
        const body = request.body as CreateApplicationBody;
        const application = await createSeasonalAppleJobApplication(body);
        return reply.code(201).send({
          ok: true,
          message: 'تم تسجيل الطلب بنجاح',
          applicationId: application.id,
          application,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'INVALID_APPLICATION';
        return reply.code(400).send({
          ok: false,
          error: message,
        });
      }
    },
  );

  app.get('/api/koudama/surveys/seasonal-apple-job/accepted', async (_request, reply) => {
    const applications = await listAcceptedSeasonalAppleJobApplications();
    return reply.send({
      ok: true,
      applications,
    });
  });

  app.get('/api/admin/koudama/surveys/seasonal-apple-job/applications', async (request, reply) => {
    if (!(await requireSeasonalSurveyAdmin(request, reply))) {
      return;
    }

    const applications = await listSeasonalAppleJobApplications();
    return reply.send({
      ok: true,
      applications,
    });
  });

  app.get<{ Params: { id: string } }>(
    '/api/admin/koudama/surveys/seasonal-apple-job/applications/:id',
    async (request, reply) => {
      if (!(await requireSeasonalSurveyAdmin(request, reply))) {
        return;
      }

      const application = await getSeasonalAppleJobApplication(request.params.id);
      if (!application) {
        return reply.code(404).send({ ok: false, error: 'APPLICATION_NOT_FOUND' });
      }

      return reply.send({ ok: true, application });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateApplicationBody }>(
    '/api/admin/koudama/surveys/seasonal-apple-job/applications/:id',
    async (request, reply) => {
      if (!(await requireSeasonalSurveyAdmin(request, reply))) {
        return;
      }

      const body = request.body as UpdateApplicationBody;
      const application = await updateSeasonalAppleJobApplication(request.params.id, body);
      if (!application) {
        return reply.code(404).send({ ok: false, error: 'APPLICATION_NOT_FOUND' });
      }

      return reply.send({ ok: true, application });
    },
  );

  app.get('/api/admin/koudama/surveys/seasonal-apple-job/export.csv', async (request, reply) => {
    if (!(await requireSeasonalSurveyAdmin(request, reply))) {
      return;
    }

    const csv = await exportSeasonalAppleJobApplicationsCsv();
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="seasonal-apple-job-applications.csv"')
      .send(csv);
  });
}
