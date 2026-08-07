export type KbImportStatus =
  | "UPLOADED"
  | "QUARANTINED"
  | "SCAN_PASSED"
  | "SCAN_FAILED"
  | "EXTRACTION_RUNNING"
  | "EXTRACTION_FAILED"
  | "EXTRACTION_COMPLETED"
  | "KB_DRAFT_CREATED"
  | "NEEDS_ADMIN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "FAILED";

export type KbImportSourceType =
  | "image"
  | "pdf"
  | "docx"
  | "text"
  | "html"
  | "csv"
  | "json"
  | "manual"
  | "unknown";

export type KbImportCategory =
  | "pensions_entitlements"
  | "procedures_requests"
  | "documents_certificates"
  | "healthcare_hospitalization"
  | "recruitment_announcements"
  | "payment_intelligence"
  | "laws_directives"
  | "phonebook_directory"
  | "community_market"
  | "broadcasting_media"
  | "faq_general"
  | "admin_internal"
  | "unknown_needs_review";

export interface KbImportAsset {
  id: string;
  originalName: string;
  storedName: string;
  storedPath: string;
  sha256: string;
  bytes: number;
  mimeType?: string;
  extension?: string;
}

export interface KbCitation {
  id: string;
  jobId: string;
  sourceLabel: string;
  assetId?: string;
  sourceUrl?: string;
  pageNumber?: number;
  extractedAt: string;
  confidence: number;
}

export interface KbFact {
  id: string;
  jobId: string;
  category: KbImportCategory;
  title: string;
  cleanText: string;
  rawText: string;
  language: string;
  confidence: number;
  citationId: string;
  tags: string[];
  visibility: "admin_review" | "internal" | "public";
}

export interface KbChunk {
  id: string;
  jobId: string;
  category: KbImportCategory;
  text: string;
  citationId: string;
  tags: string[];
  tokenEstimate: number;
}

export interface KbImportJob {
  id: string;
  sourceName: string;
  sourceType: KbImportSourceType;
  sourceUrl?: string;
  categoryHint?: string;
  detectedCategory: KbImportCategory;
  languageHint?: string;
  detectedLanguage: string;
  status: KbImportStatus;
  reviewStatus: "pending" | "approved" | "rejected";
  publishStatus: "not_published" | "published";
  confidence: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  rawText?: string;
  cleanedText?: string;
  errorCode?: string;
  errorMessage?: string;
  asset?: KbImportAsset;
  citations: KbCitation[];
  facts: KbFact[];
  chunks: KbChunk[];
  audit: Array<{ at: string; event: string; detail?: string }>;
}

export interface CreateRawImportInput {
  sourceName: string;
  rawText: string;
  sourceType?: KbImportSourceType;
  sourceUrl?: string;
  categoryHint?: string;
  languageHint?: string;
  createdBy?: string;
}