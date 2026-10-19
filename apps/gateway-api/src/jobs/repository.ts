import { query } from "../lib/db.js";
import type { JobApplicationRecord } from "./types.js";

export interface MarketplaceJobApplicationsRepository {
  findByJobAndPhone(jobId: string, phone: string): Promise<JobApplicationRecord | undefined>;
  save(application: JobApplicationRecord): Promise<JobApplicationRecord>;
  listByPhone(phone: string): Promise<JobApplicationRecord[]>;
  listAll(): Promise<JobApplicationRecord[]>;
  updateStatus(id: string, status: JobApplicationRecord["status"]): Promise<JobApplicationRecord | undefined>;
}

function mapRow(row: Record<string, unknown>): JobApplicationRecord {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    veteran_name: String(row.veteran_name),
    phone: String(row.phone),
    email: row.email == null ? undefined : String(row.email),
    cover_letter: row.cover_letter == null ? undefined : String(row.cover_letter),
    status: String(row.status) as JobApplicationRecord["status"],
    applied_at: new Date(String(row.applied_at)).toISOString(),
  };
}

export class InMemoryMarketplaceJobApplicationsRepository implements MarketplaceJobApplicationsRepository {
  private readonly rows: JobApplicationRecord[] = [];

  async findByJobAndPhone(jobId: string, phone: string) {
    return this.rows.find((row) => row.job_id === jobId && row.phone === phone);
  }

  async save(application: JobApplicationRecord) {
    this.rows.push({ ...application });
    return { ...application };
  }

  async listByPhone(phone: string) {
    return this.rows.filter((row) => row.phone === phone).map((row) => ({ ...row }));
  }

  async listAll() {
    return this.rows.map((row) => ({ ...row }));
  }

  async updateStatus(id: string, status: JobApplicationRecord["status"]) {
    const row = this.rows.find((entry) => entry.id === id);
    if (!row) return undefined;
    row.status = status;
    return { ...row };
  }
}

export class PostgresMarketplaceJobApplicationsRepository implements MarketplaceJobApplicationsRepository {
  async findByJobAndPhone(jobId: string, phone: string) {
    const result = await query(
      "SELECT id, job_id, veteran_name, phone, email, cover_letter, status, applied_at FROM marketplace_job_applications WHERE job_id = $1 AND phone = $2",
      [jobId, phone],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async save(application: JobApplicationRecord) {
    const result = await query(
      `INSERT INTO marketplace_job_applications
        (id, job_id, veteran_name, phone, email, cover_letter, status, applied_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, job_id, veteran_name, phone, email, cover_letter, status, applied_at`,
      [application.id, application.job_id, application.veteran_name, application.phone, application.email || null, application.cover_letter || null, application.status, application.applied_at],
    );
    return mapRow(result.rows[0]);
  }

  async listByPhone(phone: string) {
    const result = await query(
      "SELECT id, job_id, veteran_name, phone, email, cover_letter, status, applied_at FROM marketplace_job_applications WHERE phone = $1 ORDER BY applied_at DESC",
      [phone],
    );
    return result.rows.map((row) => mapRow(row));
  }

  async listAll() {
    const result = await query(
      "SELECT id, job_id, veteran_name, phone, email, cover_letter, status, applied_at FROM marketplace_job_applications ORDER BY applied_at DESC",
    );
    return result.rows.map((row) => mapRow(row));
  }

  async updateStatus(id: string, status: JobApplicationRecord["status"]) {
    const result = await query(
      "UPDATE marketplace_job_applications SET status = $2 WHERE id = $1 RETURNING id, job_id, veteran_name, phone, email, cover_letter, status, applied_at",
      [id, status],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }
}

export const marketplaceJobApplicationsRepository: MarketplaceJobApplicationsRepository = new PostgresMarketplaceJobApplicationsRepository();