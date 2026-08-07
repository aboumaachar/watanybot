export type OfficialSourceStatus = 'source_mapped' | 'imported' | 'needs_review' | 'failed';

export type OfficialSourceRecord = {
  id: string;
  sourceKey: string;
  type: string;
  sourceUrl: string;
  importedAt?: string;
  status: OfficialSourceStatus;
  note?: string;
};
