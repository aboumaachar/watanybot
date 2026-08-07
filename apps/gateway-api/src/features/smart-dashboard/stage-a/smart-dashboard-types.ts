// APEX_SMART_ADAPTIVE_DASHBOARD_STAGE_A_IMPLEMENTATION_v1
// Stage A shared types. Additive module; wire into the existing gateway router after review.

export type SmartDashboardRole = 'VETERAN' | 'RETIRED_OFFICER' | 'FAMILY_MEMBER' | 'ADMIN' | 'SUPERADMIN';

export type SmartDashboardEventType =
  | 'CLICK'
  | 'SEARCH_INTENT'
  | 'PAGE_VIEW'
  | 'NOTIFICATION_OPEN'
  | 'IMPRESSION'
  | 'PIN'
  | 'UNPIN';

export type SmartDashboardIntentCategory =
  | 'pension_query'
  | 'healthcare_query'
  | 'procedure_query'
  | 'document_query'
  | 'law_query'
  | 'salary_query'
  | 'compensation_query'
  | 'school_query'
  | 'general_query';

export interface SmartDashboardAuthContext {
  userId: string;
  role: SmartDashboardRole;
}

export interface SmartDashboardFeature {
  key: string;
  title_ar: string;
  title_en: string;
  route: string;
  icon_key: string;
  group_ar: string;
  required_roles: SmartDashboardRole[];
  default_priority: number;
  is_critical: boolean;
  personalization_allowed: boolean;
  notification_category: string | null;
  synonyms_ar: string[];
  smoke_test_route: string;
  visibility_condition: string | null;
  registry_version: number;
}

export interface SafeActivityMetadata {
  feature_key: string;
  sub_section: string | null;
  intent_category: SmartDashboardIntentCategory | null;
}

export interface SmartDashboardCard {
  feature_key: string;
  title_ar: string;
  route: string;
  icon_key: string;
  group_ar: string;
  is_critical: boolean;
  dismissable: boolean;
  reason_label?: string;
}