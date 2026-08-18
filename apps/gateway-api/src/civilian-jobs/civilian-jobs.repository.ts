import type {
  CivilianOpportunity,
  OpportunityApplicationRecord,
  OpportunitySource,
  OpportunityStatus,
} from "./civilian-jobs.types";
import { civilianOpportunitySeed, civilianOpportunitySources } from "./civilian-jobs.seed";
import { query } from "../lib/db.js";

export type CivilianJobAuditEvent = {
  id: string;
  entityType: "OPPORTUNITY" | "APPLICATION" | "SOURCE" | "IMPORT";
  entityId: string;
  action: string;
  actorId?: string;
  note?: string;
  createdAt: string;
};

export type ImportedCivilianJobOpportunity = {
  id: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  organization?: string;
  location?: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "DUPLICATE";
  normalizedPayload?: Record<string, unknown>;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
};

export interface CivilianJobsRepository {
  listOpportunities(): Promise<CivilianOpportunity[]>;
  getOpportunity(id: string): Promise<CivilianOpportunity | undefined>;
  saveOpportunity(row: CivilianOpportunity): Promise<CivilianOpportunity>;
  updateOpportunityStatus(id: string, status: OpportunityStatus, actorId?: string, note?: string): Promise<CivilianOpportunity>;
  listApplications(): Promise<OpportunityApplicationRecord[]>;
  saveApplication(row: OpportunityApplicationRecord): Promise<OpportunityApplicationRecord>;
  listSources(): Promise<OpportunitySource[]>;
  saveSource(row: OpportunitySource): Promise<OpportunitySource>;
  listImported(): Promise<ImportedCivilianJobOpportunity[]>;
  saveImported(row: ImportedCivilianJobOpportunity): Promise<ImportedCivilianJobOpportunity>;
  addAuditEvent(event: CivilianJobAuditEvent): Promise<void>;
  listAuditEvents(entityType?: string, entityId?: string): Promise<CivilianJobAuditEvent[]>;
}

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export class InMemoryCivilianJobsRepository implements CivilianJobsRepository {
  private opportunities = new Map<string, CivilianOpportunity>();
  private applications = new Map<string, OpportunityApplicationRecord>();
  private sources = new Map<string, OpportunitySource>();
  private imported = new Map<string, ImportedCivilianJobOpportunity>();
  private auditEvents: CivilianJobAuditEvent[] = [];

  constructor() {
    for (const source of civilianOpportunitySources) this.sources.set(source.id, { ...source });
    for (const opportunity of civilianOpportunitySeed) this.opportunities.set(opportunity.id, { ...opportunity });
  }

  async listOpportunities() { return [...this.opportunities.values()].map((x) => ({ ...x })); }
  async getOpportunity(id: string) { const row = this.opportunities.get(id); return row ? { ...row } : undefined; }
  async saveOpportunity(row: CivilianOpportunity) { this.opportunities.set(row.id, { ...row }); return { ...row }; }

  async updateOpportunityStatus(id: string, status: OpportunityStatus, actorId?: string, note?: string) {
    const existing = this.opportunities.get(id);
    if (!existing) throw new Error(`Civilian job opportunity not found: ${id}`);
    const updated: CivilianOpportunity = { ...existing, status, updatedAt: nowIso() };
    this.opportunities.set(id, updated);
    await this.addAuditEvent({ id: makeId("audit"), entityType: "OPPORTUNITY", entityId: id, action: `STATUS_${status}`, actorId, note, createdAt: nowIso() });
    return { ...updated };
  }

  async listApplications() { return [...this.applications.values()].map((x) => ({ ...x })); }
  async saveApplication(row: OpportunityApplicationRecord) { this.applications.set(row.id, { ...row }); return { ...row }; }
  async listSources() { return [...this.sources.values()].map((x) => ({ ...x })); }
  async saveSource(row: OpportunitySource) { this.sources.set(row.id, { ...row }); return { ...row }; }
  async listImported() { return [...this.imported.values()].map((x) => ({ ...x })); }
  async saveImported(row: ImportedCivilianJobOpportunity) { this.imported.set(row.id, { ...row }); return { ...row }; }
  async addAuditEvent(event: CivilianJobAuditEvent) { this.auditEvents.push({ ...event }); }
  async listAuditEvents(entityType?: string, entityId?: string) {
    return this.auditEvents.filter((e) => (!entityType || e.entityType === entityType) && (!entityId || e.entityId === entityId)).map((x) => ({ ...x }));
  }
}

function mapApplication(row: Record<string, unknown>): OpportunityApplicationRecord {
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    applicantName: String(row.applicant_name),
    applicantPhone: String(row.applicant_phone || ""),
    applicantType: String(row.applicant_type) as OpportunityApplicationRecord["applicantType"],
    status: String(row.status) as OpportunityApplicationRecord["status"],
    note: row.note == null ? undefined : String(row.note),
    cvUrl: row.cv_url == null ? undefined : String(row.cv_url),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresCivilianJobsRepository implements CivilianJobsRepository {
  private readonly fallback = new InMemoryCivilianJobsRepository();

  async listOpportunities() { return this.fallback.listOpportunities(); }
  async getOpportunity(id: string) { return this.fallback.getOpportunity(id); }
  async saveOpportunity(row: CivilianOpportunity) { return this.fallback.saveOpportunity(row); }
  async updateOpportunityStatus(id: string, status: OpportunityStatus, actorId?: string, note?: string) {
    return this.fallback.updateOpportunityStatus(id, status, actorId, note);
  }

  async listApplications() {
    const result = await query("SELECT id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at FROM civilian_job_applications ORDER BY created_at DESC");
    return result.rows.map((row) => mapApplication(row));
  }

  async saveApplication(row: OpportunityApplicationRecord) {
    const result = await query(
      `INSERT INTO civilian_job_applications
        (id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at`,
      [row.id, row.opportunityId, row.applicantName, row.applicantPhone, row.applicantType, row.status, row.note || null, row.cvUrl || null, row.createdAt, row.updatedAt],
    );
    return mapApplication(result.rows[0]);
  }

  async listSources() { return this.fallback.listSources(); }
  async saveSource(row: OpportunitySource) { return this.fallback.saveSource(row); }
  async listImported() { return this.fallback.listImported(); }
  async saveImported(row: ImportedCivilianJobOpportunity) { return this.fallback.saveImported(row); }
  async addAuditEvent(event: CivilianJobAuditEvent) { return this.fallback.addAuditEvent(event); }
  async listAuditEvents(entityType?: string, entityId?: string) { return this.fallback.listAuditEvents(entityType, entityId); }
}

export const civilianJobsRepository: CivilianJobsRepository = new PostgresCivilianJobsRepository();