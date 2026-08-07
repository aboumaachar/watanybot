export type UsefulLink = {
  id: string;
  label: string;
  url: string;
  category: string;
  institution?: string;
  description?: string;
  official: boolean;
  lastCheckedAt?: string;
  status?: 'active' | 'broken' | 'needs_review';
};
