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
  updateApplicationStatus(id: string, status: OpportunityApplicationRecord["status"]): Promise<OpportunityApplicationRecord | undefined>;
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
    const updated: CivilianOpportunity = { ...existing, status, adminVerified: status === "PUBLISHED", updatedAt: nowIso() };
    this.opportunities.set(id, updated);
    await this.addAuditEvent({ id: makeId("audit"), entityType: "OPPORTUNITY", entityId: id, action: `STATUS_${status}`, actorId, note, createdAt: nowIso() });
    return { ...updated };
  }

  async listApplications() { return [...this.applications.values()].map((x) => ({ ...x })); }
  async saveApplication(row: OpportunityApplicationRecord) { this.applications.set(row.id, { ...row }); return { ...row }; }
  async updateApplicationStatus(id: string, status: OpportunityApplicationRecord["status"]) {
    const existing = this.applications.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, status, updatedAt: nowIso() };
    this.applications.set(id, updated);
    return { ...updated };
  }

  async listSources() { return [...this.sources.values()].map((x) => ({ ...x })); }
  async saveSource(row: OpportunitySource) { this.sources.set(row.id, { ...row }); return { ...row }; }
  async listImported() { return [...this.imported.values()].map((x) => ({ ...x })); }
  async saveImported(row: ImportedCivilianJobOpportunity) { this.imported.set(row.id, { ...row }); return { ...row }; }
  async addAuditEvent(event: CivilianJobAuditEvent) { this.auditEvents.push({ ...event }); }
  async listAuditEvents(entityType?: string, entityId?: string) {
    return this.auditEvents
      .filter((event) => (!entityType || event.entityType === entityType) && (!entityId || event.entityId === entityId))
      .map((x) => ({ ...x }));
  }
}

function parseStringArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return undefined;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined; } catch { return undefined; }
}

function mapOpportunity(row: Record<string, unknown>): CivilianOpportunity {
  return {
    id: String(row.id),
    type: String(row.type) as CivilianOpportunity["type"],
    audience: parseStringArray(row.audience, ["PUBLIC"]) as CivilianOpportunity["audience"],
    title: String(row.title),
    organization: String(row.organization),
    location: String(row.location || ""),
    category: String(row.category || ""),
    summary: String(row.summary || ""),
    description: String(row.description || ""),
    requirements: parseStringArray(row.requirements),
    applicationMethod: String(row.application_method || ""),
    sourceName: row.source_name == null ? undefined : String(row.source_name),
    sourceUrl: row.source_url == null ? undefined : String(row.source_url),
    deadline: row.deadline == null ? undefined : String(row.deadline),
    status: String(row.status) as CivilianOpportunity["status"],
    adminVerified: row.admin_verified === true || row.admin_verified === 1 || row.admin_verified === "1",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
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

function mapSource(row: Record<string, unknown>): OpportunitySource {
  return {
    id: String(row.id),
    name: String(row.name),
    url: String(row.website_url || ""),
    sourceType: String(row.source_type || "MANUAL") as OpportunitySource["sourceType"],
    crawlPolicy: String(row.crawl_policy || "MANUAL_ONLY") as OpportunitySource["crawlPolicy"],
    enabled: row.enabled === true || row.enabled === 1 || row.enabled === "1",
    notes: String(row.notes || ""),
  };
}

function mapImported(row: Record<string, unknown>): ImportedCivilianJobOpportunity {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    sourceUrl: String(row.source_url),
    title: String(row.title),
    organization: row.organization == null ? undefined : String(row.organization),
    location: row.location == null ? undefined : String(row.location),
    status: String(row.status) as ImportedCivilianJobOpportunity["status"],
    normalizedPayload: parseObject(row.normalized_payload),
    decisionNote: row.decision_note == null ? undefined : String(row.decision_note),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapAudit(row: Record<string, unknown>): CivilianJobAuditEvent {
  return {
    id: String(row.id),
    entityType: String(row.entity_type) as CivilianJobAuditEvent["entityType"],
    entityId: String(row.entity_id),
    action: String(row.action),
    actorId: row.actor_id == null ? undefined : String(row.actor_id),
    note: row.note == null ? undefined : String(row.note),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export class PostgresCivilianJobsRepository implements CivilianJobsRepository {
  async listOpportunities() {
    const result = await query(`SELECT id,type,status,title,organization,location,category,summary,description,audience,requirements,application_method,source_name,source_url,deadline,admin_verified,created_at,updated_at FROM civilian_job_opportunities ORDER BY created_at DESC`);
    return result.rows.map((row) => mapOpportunity(row));
  }

  async getOpportunity(id: string) {
    const result = await query(`SELECT id,type,status,title,organization,location,category,summary,description,audience,requirements,application_method,source_name,source_url,deadline,admin_verified,created_at,updated_at FROM civilian_job_opportunities WHERE id=$1 LIMIT 1`, [id]);
    return result.rows[0] ? mapOpportunity(result.rows[0]) : undefined;
  }

  async saveOpportunity(row: CivilianOpportunity) {
    const result = await query(`INSERT INTO civilian_job_opportunities
      (id,type,status,title,organization,location,category,summary,description,audience,requirements,application_method,source_name,source_url,deadline,admin_verified,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,status=EXCLUDED.status,title=EXCLUDED.title,organization=EXCLUDED.organization,location=EXCLUDED.location,category=EXCLUDED.category,summary=EXCLUDED.summary,description=EXCLUDED.description,audience=EXCLUDED.audience,requirements=EXCLUDED.requirements,application_method=EXCLUDED.application_method,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,deadline=EXCLUDED.deadline,admin_verified=EXCLUDED.admin_verified,updated_at=EXCLUDED.updated_at
      RETURNING id,type,status,title,organization,location,category,summary,description,audience,requirements,application_method,source_name,source_url,deadline,admin_verified,created_at,updated_at`,
      [row.id,row.type,row.status,row.title,row.organization,row.location,row.category,row.summary,row.description,JSON.stringify(row.audience),JSON.stringify(row.requirements),row.applicationMethod,row.sourceName||null,row.sourceUrl||null,row.deadline||null,row.adminVerified,row.createdAt,row.updatedAt]);
    return mapOpportunity(result.rows[0]);
  }

  async updateOpportunityStatus(id: string, status: OpportunityStatus, actorId?: string, note?: string) {
    const result = await query(`UPDATE civilian_job_opportunities SET status=$2,admin_verified=$3,updated_at=$4 WHERE id=$1 RETURNING id,type,status,title,organization,location,category,summary,description,audience,requirements,application_method,source_name,source_url,deadline,admin_verified,created_at,updated_at`, [id,status,status === "PUBLISHED",nowIso()]);
    if (!result.rows[0]) throw new Error(`Civilian job opportunity not found: ${id}`);
    await this.addAuditEvent({ id: makeId("audit"), entityType: "OPPORTUNITY", entityId: id, action: `STATUS_${status}`, actorId, note, createdAt: nowIso() });
    return mapOpportunity(result.rows[0]);
  }

  async listApplications() {
    const result = await query("SELECT id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at FROM civilian_job_applications ORDER BY created_at DESC");
    return result.rows.map((row) => mapApplication(row));
  }

  async saveApplication(row: OpportunityApplicationRecord) {
    const result = await query(`INSERT INTO civilian_job_applications
      (id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, opportunity_id, applicant_name, applicant_phone, applicant_type, status, note, cv_url, created_at, updated_at`,
      [row.id,row.opportunityId,row.applicantName,row.applicantPhone,row.applicantType,row.status,row.note||null,row.cvUrl||null,row.createdAt,row.updatedAt]);
    return mapApplication(result.rows[0]);
  }

  async updateApplicationStatus(id: string, status: OpportunityApplicationRecord["status"]) {
    const result = await query(`UPDATE civilian_job_applications SET status=$2,updated_at=$3 WHERE id=$1 RETURNING id,opportunity_id,applicant_name,applicant_phone,applicant_type,status,note,cv_url,created_at,updated_at`, [id,status,nowIso()]);
    return result.rows[0] ? mapApplication(result.rows[0]) : undefined;
  }

  async listSources() {
    const result = await query(`SELECT id,name,source_type,website_url,enabled,crawl_policy,notes FROM civilian_job_opportunity_sources ORDER BY name`);
    return result.rows.map((row) => mapSource(row));
  }

  async saveSource(row: OpportunitySource) {
    const result = await query(`INSERT INTO civilian_job_opportunity_sources
      (id,name,source_type,website_url,adapter_kind,enabled,compliance_status,crawl_policy,notes,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'MANUAL',$5,'REVIEW_REQUIRED',$6,$7,$8,$8)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,source_type=EXCLUDED.source_type,website_url=EXCLUDED.website_url,enabled=EXCLUDED.enabled,crawl_policy=EXCLUDED.crawl_policy,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at
      RETURNING id,name,source_type,website_url,enabled,crawl_policy,notes`,
      [row.id,row.name,row.sourceType,row.url,row.enabled ? 1 : 0,row.crawlPolicy,row.notes,nowIso()]);
    return mapSource(result.rows[0]);
  }

  async listImported() {
    const result = await query(`SELECT id,source_id,source_url,title,organization,location,status,normalized_payload,decision_note,created_at,updated_at FROM civilian_job_imported_opportunities ORDER BY created_at DESC`);
    return result.rows.map((row) => mapImported(row));
  }

  async saveImported(row: ImportedCivilianJobOpportunity) {
    const result = await query(`INSERT INTO civilian_job_imported_opportunities
      (id,source_id,source_url,title,organization,location,normalized_payload,status,created_at,updated_at,decision_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET source_url=EXCLUDED.source_url,title=EXCLUDED.title,organization=EXCLUDED.organization,location=EXCLUDED.location,normalized_payload=EXCLUDED.normalized_payload,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at,decision_note=EXCLUDED.decision_note
      RETURNING id,source_id,source_url,title,organization,location,status,normalized_payload,decision_note,created_at,updated_at`,
      [row.id,row.sourceId,row.sourceUrl,row.title,row.organization||null,row.location||null,row.normalizedPayload ? JSON.stringify(row.normalizedPayload) : null,row.status,row.createdAt,row.updatedAt,row.decisionNote||null]);
    return mapImported(result.rows[0]);
  }

  async addAuditEvent(event: CivilianJobAuditEvent) {
    await query(`INSERT INTO civilian_job_admin_audit_events (id,entity_type,entity_id,action,actor_id,note,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [event.id,event.entityType,event.entityId,event.action,event.actorId||null,event.note||null,event.createdAt]);
  }

  async listAuditEvents(entityType?: string, entityId?: string) {
    const params: unknown[] = [];
    const where: string[] = [];
    if (entityType) { params.push(entityType); where.push(`entity_type=$${params.length}`); }
    if (entityId) { params.push(entityId); where.push(`entity_id=$${params.length}`); }
    const result = await query(`SELECT id,entity_type,entity_id,action,actor_id,note,created_at FROM civilian_job_admin_audit_events${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`, params);
    return result.rows.map((row) => mapAudit(row));
  }
}

export const civilianJobsRepository: CivilianJobsRepository = new PostgresCivilianJobsRepository();
