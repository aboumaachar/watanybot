/* ── Job Search Feature – Type definitions ───────────── */

export type JobCategory = {
  id: number;
  name_ar: string;
  name_en: string;
  icon: string;
  description_ar: string;
};

export type Employer = {
  id: string;
  company_name: string;
  company_name_en?: string;
  industry?: string;
  company_size?: string;
  email: string;
  phone?: string;
  website?: string;
  city?: string;
  description_ar?: string;
  logo_url?: string;
  verified: boolean;
  veteran_friendly: boolean;
};

export type JobPosting = {
  id: string;
  employer_id: string;
  category_id: number;

  title_ar: string;
  title_en?: string;
  description_ar: string;

  requirements_ar?: string;
  qualifications_ar?: string;
  experience_years?: number;
  education_level?: string;

  job_type: "full_time" | "part_time" | "contract" | "freelance";
  employment_type?: string;

  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  salary_period?: string;
  show_salary: boolean;

  benefits?: string[];

  location_city?: string;
  location_area?: string;
  remote_work: boolean;
  hybrid_work: boolean;

  skills_required?: string[];
  languages_required?: string[];

  veteran_only: boolean;
  veteran_preferred: boolean;
  military_rank_suitable?: string[];

  application_deadline?: string;

  status: "draft" | "active" | "paused" | "closed" | "filled";
  featured: boolean;
  urgent: boolean;

  views_count: number;
  applications_count: number;

  published_at: string;
  created_at: string;
};

export type VeteranProfile = {
  id: string;
  user_id?: string;
  full_name: string;
  military_id?: string;
  rank?: string;
  branch?: string;
  years_of_service?: number;
  specialization?: string;
  discharge_type?: string;
  phone: string;
  email: string;
  city?: string;
  skills?: string[];
  languages?: Record<string, string>;
  profile_completeness: number;
};

export type JobApplicationRecord = {
  id: string;
  job_id: string;
  veteran_name: string;
  phone: string;
  email?: string;
  cover_letter?: string;
  status: "pending" | "reviewing" | "shortlisted" | "interview" | "rejected" | "accepted" | "withdrawn";
  applied_at: string;
};

export type JobAlert = {
  id: string;
  user_id?: string;
  alert_name: string;
  keywords?: string[];
  categories?: number[];
  location_cities?: string[];
  job_types?: string[];
  salary_min?: number;
  veteran_only: boolean;
  frequency: "instant" | "daily" | "weekly";
  active: boolean;
};

export type SavedJob = {
  id: string;
  user_id?: string;
  job_id: string;
  notes?: string;
  created_at: string;
};

/* ── API response shapes ─────────────────────────────── */

export type JobSearchResult = {
  id: string;
  title_ar: string;
  company_name: string;
  company_logo?: string;
  location_city?: string;
  job_type: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  show_salary: boolean;
  veteran_preferred: boolean;
  urgent: boolean;
  featured: boolean;
  published_at: string;
  tags: string[];
};
