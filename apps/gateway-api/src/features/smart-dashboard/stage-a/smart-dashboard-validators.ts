// APEX_SMART_ADAPTIVE_DASHBOARD_STAGE_A_IMPLEMENTATION_v1
// Privacy-safe validators for Stage A. This intentionally rejects raw user text.

import type { SafeActivityMetadata, SmartDashboardEventType, SmartDashboardIntentCategory } from './smart-dashboard-types';

const eventTypes = new Set<SmartDashboardEventType>([
  'CLICK',
  'SEARCH_INTENT',
  'PAGE_VIEW',
  'NOTIFICATION_OPEN',
  'IMPRESSION',
  'PIN',
  'UNPIN',
]);

const intentCategories = new Set<SmartDashboardIntentCategory>([
  'pension_query',
  'healthcare_query',
  'procedure_query',
  'document_query',
  'law_query',
  'salary_query',
  'compensation_query',
  'school_query',
  'general_query',
]);

const forbiddenKeys = new Set([
  'raw',
  'raw_text',
  'question',
  'message',
  'chat',
  'prompt',
  'answer',
  'salary_value',
  'medical_detail',
  'diagnosis',
  'ip_address',
  'device_id',
  'location',
]);

export function isAllowedEventType(value: unknown): value is SmartDashboardEventType {
  return typeof value === 'string' && eventTypes.has(value as SmartDashboardEventType);
}

export function isAllowedIntentCategory(value: unknown): value is SmartDashboardIntentCategory {
  return typeof value === 'string' && intentCategories.has(value as SmartDashboardIntentCategory);
}

export function validateSafeMetadata(value: unknown): SafeActivityMetadata {
  if (value === undefined || value === null) {
    return { feature_key: '', sub_section: null, intent_category: null };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('metadata_json must be an object.');
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue);
  const allowedKeys = new Set(['feature_key', 'sub_section', 'intent_category']);

  for (const key of keys) {
    if (!allowedKeys.has(key) || forbiddenKeys.has(key.toLowerCase())) {
      throw new Error('metadata_json contains an unsafe key.');
    }
  }

  const featureKey = objectValue.feature_key;
  const subSection = objectValue.sub_section;
  const intentCategory = objectValue.intent_category;

  if (typeof featureKey !== 'string' || featureKey.trim().length === 0 || featureKey.length > 100) {
    throw new Error('metadata_json.feature_key is required.');
  }

  if (!(subSection === null || subSection === undefined || typeof subSection === 'string')) {
    throw new Error('metadata_json.sub_section must be string or null.');
  }

  if (!(intentCategory === null || intentCategory === undefined || isAllowedIntentCategory(intentCategory))) {
    throw new Error('metadata_json.intent_category is invalid.');
  }

  return {
    feature_key: featureKey,
    sub_section: typeof subSection === 'string' ? subSection : null,
    intent_category: isAllowedIntentCategory(intentCategory) ? intentCategory : null,
  };
}