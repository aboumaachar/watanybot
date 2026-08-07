/* ── Procedure V3 Types ─────────────────────────────── */

export type Procedure = {
  id: string;
  tx_no?: number;
  source?: string; // laf | mof | internal
  source_label?: string;
  title_ar: string;
  title_en?: string;
  summary_lb: string;

  section_path?: string[];
  section_label?: string;
  legal_basis?: Array<{ source: string; articles?: string[]; note?: string; allows?: boolean }>;

  eligibility?: string[];
  requirements?: string[];
  steps?: string[];
  where_to_apply?: string[];
  fees?: string[];
  timelines?: string[];
  contacts?: string[];
  exceptions?: string[];

  faq_variants?: string[];
  tags?: string[];

  source_anchors?: Array<{ file: string; anchor?: string }>;
  source_refs?: SourceRef[];

  audience_scope?: ProcedureAudienceScope;
  applies_to?: string[];
  content_tier?: ProcedureContentTier;
  domain?: string;

  version?: string;
  last_updated?: string;
};

export type ProcedureAudienceScope =
  | "veteran_direct"
  | "family_direct"
  | "veteran_or_family"
  | "retired_army_only"
  | "retired_all_forces"
  | "active_service_only"
  | "institutional_admin"
  | "public_general";

export type ProcedureContentTier = "frontline" | "supporting" | "archive";

export type SourceRef = {
  source_id?: string;
  source_path?: string;
  anchor?: string;
};

export type StoredDocAction = {
  action?: string;
  enabled?: boolean;
  mode?: string;
  target?: string;
  fragment?: string;
  note?: string;
};

export type StoredDocAsset = {
  id: string;
  title: string;
  url?: string | null;
  asset_type?: string;
  file_format?: string;
  file_name?: string | null;
  file_path?: string | null;
  public_url?: string | null;
  preview_enabled?: boolean;
  download_enabled?: boolean;
  share_enabled?: boolean;
  description_lb?: string;
  tags?: string[];
  linked_procedures?: string[];
  linked_directory_entries?: string[];
  source_refs?: SourceRef[];
  source_href?: string | null;
  link_kind?: string | null;
  resolved_path?: string | null;
  exported_file_path?: string | null;
  asset_delivery_kind?: string | null;
  asset_delivery_note?: string | null;
  source_anchor?: string | null;
  preview_action?: StoredDocAction;
  download_action?: StoredDocAction;
  share_action?: StoredDocAction;
};

export type DocAction = {
  enabled: boolean;
  url?: string;
  mode?: string;
  target?: string;
  fragment?: string;
  note?: string;
};

export type DocRef = {
  id: string;
  title: string;
  url: string;
  source: string; // mof | laf | other
  source_label?: string;
  kind?: string;  // form | guide | template | link
  preview?: boolean;
  download?: boolean;
  share?: boolean;
  preview_url?: string;
  download_url?: string;
  share_url?: string;
  file_format?: string;
  file_name?: string | null;
  description_lb?: string;
  exported_file_path?: string | null;
  asset_delivery_kind?: string | null;
  asset_delivery_note?: string | null;
  source_anchor?: string | null;
  link_kind?: string | null;
  actions?: {
    preview?: DocAction;
    download?: DocAction;
    share?: DocAction;
  };
  tags?: string[];
};

export type ProcToDocs = {
  procedure_id: string;
  doc_ids: string[];
  attached_docs?: Array<Record<string, unknown>>;
  confidence?: number;
  reason?: string;
};

export type ProcedureHit = {
  id: string;
  title_ar: string;
  summary_lb: string;
  steps?: string[];
  title_clean?: string;
  summary_clean?: string;
  tags: string[];
  source?: string;
  source_label?: string;
  source_anchors?: Array<{ file: string; anchor?: string }>;
  section_path?: string[];
  section_label?: string;
  record_kind?: "procedure" | "reference" | "notice" | "fragment";
  quality_flag?: "clean" | "noisy_title";
  audience_scope?: ProcedureAudienceScope;
  applies_to?: string[];
  content_tier?: ProcedureContentTier;
  domain?: string;
  relevance_weight?: number;
  score: number;
};
