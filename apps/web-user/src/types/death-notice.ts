export type DeathNoticeSource =
  | 'army_official'
  | 'isf_official'
  | 'admin_input';

export type DeathNotice = {
  id: string;
  source: DeathNoticeSource;
  sourceUrl?: string;
  sourceLabel: string;
  title: string;
  deceasedName?: string;
  rankOrRelation?: string;
  institution?: 'army' | 'isf' | 'general_security' | 'state_security' | 'civil_defense' | 'customs' | 'other';
  noticeDate?: string;
  funeralDate?: string;
  location?: string;
  rawText: string;
  normalizedText: string;
  contactPhones?: string[];
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
};
