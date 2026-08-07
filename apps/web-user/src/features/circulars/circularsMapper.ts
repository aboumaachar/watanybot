import { normalizeCircularRecords, type CircularSourceRecord, type NormalizedCircularRecord } from "./circularsDomainAdapter";

export function mapLafAdministrativeTransactionsToCirculars(records: readonly CircularSourceRecord[]): NormalizedCircularRecord[] {
  return normalizeCircularRecords(records);
}

export function filterCircularsByCategory(records: readonly NormalizedCircularRecord[], category: string): NormalizedCircularRecord[] {
  if (!category || category === "all") return [...records];
  return records.filter((record) => record.category === category);
}

export function searchCirculars(records: readonly NormalizedCircularRecord[], query: string): NormalizedCircularRecord[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [...records];
  return records.filter((record) => [record.title, record.issuer, record.summary, record.documentType ?? "", record.category].join(" ").toLowerCase().includes(clean));
}