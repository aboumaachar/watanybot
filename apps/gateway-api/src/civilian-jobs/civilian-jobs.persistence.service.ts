import type { OpportunityStatus } from "./civilian-jobs.types";
import {
  civilianJobsRepository,
  InMemoryCivilianJobsRepository,
  PostgresCivilianJobsRepository,
} from "./civilian-jobs.repository";
import type { CivilianJobsRepository } from "./civilian-jobs.repository";

export async function listCivilianJobAuditEvents(entityType?: string, entityId?: string) {
  return civilianJobsRepository.listAuditEvents(entityType, entityId);
}

export async function updateCivilianJobStatusWithAudit(input: {
  id: string;
  status: OpportunityStatus;
  actorId?: string;
  note?: string;
}) {
  return civilianJobsRepository.updateOpportunityStatus(input.id, input.status, input.actorId, input.note);
}

export async function getCivilianJobsPersistenceHealth(repository: CivilianJobsRepository = civilianJobsRepository) {
  const [opportunities, applications, sources, imports, auditEvents] = await Promise.all([
    repository.listOpportunities(),
    repository.listApplications(),
    repository.listSources(),
    repository.listImported(),
    repository.listAuditEvents(),
  ]);

  let mode = "CUSTOM_REPOSITORY";
  if (repository instanceof PostgresCivilianJobsRepository) {
    mode = "POSTGRES_REPOSITORY";
  } else if (repository instanceof InMemoryCivilianJobsRepository) {
    mode = "IN_MEMORY_REPOSITORY_TEST_FIXTURE";
  }

  return {
    mode,
    opportunities: opportunities.length,
    applications: applications.length,
    sources: sources.length,
    imports: imports.length,
    auditEvents: auditEvents.length,
    warning: mode === "POSTGRES_REPOSITORY" ? undefined : "Explicit test fixture; production must use the PostgreSQL repository.",
  };
}