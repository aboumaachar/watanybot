import type { OpportunityStatus } from "./civilian-jobs.types";
import { civilianJobsRepository } from "./civilian-jobs.repository";

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

export async function getCivilianJobsPersistenceHealth() {
  const [opportunities, applications, sources, imports, auditEvents] = await Promise.all([
    civilianJobsRepository.listOpportunities(),
    civilianJobsRepository.listApplications(),
    civilianJobsRepository.listSources(),
    civilianJobsRepository.listImported(),
    civilianJobsRepository.listAuditEvents(),
  ]);

  return {
    mode: "IN_MEMORY_REPOSITORY_READY_FOR_DB_ADAPTER",
    opportunities: opportunities.length,
    applications: applications.length,
    sources: sources.length,
    imports: imports.length,
    auditEvents: auditEvents.length,
    warning: "Wave04 adds a repository boundary and additive SQL migration. Wire the actual DB adapter in the next hardening step if the project persistence layer is available.",
  };
}