export type AlWafiyatSourceId = "army" | "isf" | "gsf";

export type AlWafiyatSourceProvider = "LEBANESE_ARMY" | "ISF" | "GENERAL_SECURITY";

export type AlWafiyatStatus = "IMPORTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export type AlWafiyatApprovalAction = "APPROVE" | "REJECT";

export type AlWafiyatSourceRecord = {
  id: AlWafiyatSourceId;
  sourceKey: "army_official" | "isf_official" | "gsf_official";
  providerCode: AlWafiyatSourceProvider;
  providerAr: string;
  titleAr: string;
  sourceUrl: string;
};

export type AlWafiyatPreviewNotice = {
  title: string;
  rawText: string;
  noticeDate: string;
  originalUrl: string;
  sourceId: AlWafiyatSourceId;
  sourceKey: string;
  sourceProvider: AlWafiyatSourceProvider;
  sourceProviderAr: string;
  sourceUrl: string;
  status: "IMPORTED";
  importedAt: string;
};

export type AlWafiyatNotice = {
  id: string;
  title: string;
  rank?: string | null;
  apparatus: string;
  noticeDate: string;
  sourceId: AlWafiyatSourceId;
  sourceProvider: AlWafiyatSourceProvider;
  sourceProviderAr: string;
  sourceLabelAr: string;
  sourceUrl: string;
  originalUrl: string;
  status: AlWafiyatStatus;
  importedAt: string;
  approvedAt?: string | null;
  rawText: string;
};

export type AlWafiyatNoticeLike = AlWafiyatNotice | AlWafiyatPreviewNotice;

export type AlWafiyatListResponse = {
  ok: boolean;
  items: AlWafiyatNotice[];
  total: number;
  sources: AlWafiyatSourceRecord[];
};

export type AlWafiyatHealthRecord = {
  sourceId: AlWafiyatSourceId;
  sourceProvider: AlWafiyatSourceProvider;
  sourceProviderAr: string;
  sourceUrl: string;
  reachable: boolean;
  statusCode: number | null;
  checkedAt: string;
  parsedCount: number;
};

export type AlWafiyatImportRequest = {
  previewOnly?: boolean;
  limit?: number;
};

export type AlWafiyatImportResponse = {
  ok: boolean;
  source: AlWafiyatSourceRecord;
  previewOnly: boolean;
  importedCount: number;
  total: number;
  items: AlWafiyatNoticeLike[];
};