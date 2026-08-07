/* ── Job Search v2 — API hooks ────────────────────────── */
import { useState, useEffect, useCallback } from "react";
import { getDefaultApiBaseUrl } from "./api-base";
import { LOGIN_REQUIRED_ERROR_CODE } from "./login-required";

const API = getDefaultApiBaseUrl();

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { error?: string };
    const errorCode = (payload.error || "").trim();
    if (errorCode) throw new Error(errorCode);
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/* ── Types ────────────────────────────────────────────── */

export type JobCategory = {
  id: number;
  name_ar: string;
  name_en: string;
  icon: string;
  description_ar: string;
};

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

export type JobDetail = {
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
  job_type: string;
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
  status: string;
  featured: boolean;
  urgent: boolean;
  views_count: number;
  applications_count: number;
  published_at: string;
};

export type EmployerInfo = {
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
  verified: boolean;
  veteran_friendly: boolean;
};

export type CategoryInfo = {
  id: number;
  name_ar: string;
  name_en: string;
  icon: string;
};

export type SavedJobRecord = {
  id: string;
  user_id?: string;
  job_id: string;
  notes?: string;
  created_at: string;
  title_ar?: string;
  company_name?: string;
  location_city?: string;
};

/* ── Hooks ────────────────────────────────────────────── */

export function useJobSearch() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [jobType, setJobType] = useState("");
  const [city, setCity] = useState("");
  const [veteranOnly, setVeteranOnly] = useState(false);
  const [items, setItems] = useState<JobSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (categoryId) params.set("category", String(categoryId));
      if (jobType) params.set("job_type", jobType);
      if (city) params.set("city", city);
      if (veteranOnly) params.set("veteran_only", "true");
      const res = await apiFetch<{ total: number; results: JobSearchResult[] }>(
        `/api/v2/jobs?${params.toString()}`,
      );
      setItems(res.results || []);
      setTotal(res.total || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, jobType, city, veteranOnly]);

  // Load on mount
  useEffect(() => {
    search();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    query, setQuery,
    categoryId, setCategoryId,
    jobType, setJobType,
    city, setCity,
    veteranOnly, setVeteranOnly,
    items, total, loading, search,
  };
}

export function useJobDetail(id: string | null) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [employer, setEmployer] = useState<EmployerInfo | null>(null);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    if (!id) {
      setJob(null);
      setEmployer(null);
      setCategory(null);
      setLoginRequired(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        setLoginRequired(false);
        const res = await apiFetch<{
          job: JobDetail;
          employer: EmployerInfo | null;
          category: CategoryInfo | null;
        }>(`/api/v2/jobs/${encodeURIComponent(id)}`);
        if (!cancelled) {
          setJob(res.job);
          setEmployer(res.employer);
          setCategory(res.category);
        }
      } catch (error) {
        if (!cancelled) {
          setJob(null);
          setEmployer(null);
          setCategory(null);
          setLoginRequired(error instanceof Error && error.message === LOGIN_REQUIRED_ERROR_CODE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return { job, employer, category, loading, loginRequired };
}

export function useJobCategories() {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  useEffect(() => {
    apiFetch<{ categories: JobCategory[] }>("/api/v2/jobs/categories")
      .then((r) => setCategories(r.categories || []))
      .catch(() => setCategories([]));
  }, []);
  return categories;
}

export async function applyForJob(
  jobId: string,
  data: { name: string; phone: string; email?: string; cover_letter?: string },
) {
  return apiFetch<{ ok: boolean; application: { id: string } }>(
    `/api/v2/jobs/${encodeURIComponent(jobId)}/apply`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function saveJob(jobId: string, userId?: string, notes?: string) {
  return apiFetch<{ ok: boolean }>(`/api/v2/jobs/${encodeURIComponent(jobId)}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, notes }),
  });
}

export async function unsaveJob(jobId: string, userId?: string) {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<{ ok: boolean }>(`/api/v2/jobs/${encodeURIComponent(jobId)}/save${suffix}`, {
    method: "DELETE",
  });
}

export async function listSavedJobs(userId?: string) {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<{ saved: SavedJobRecord[] }>(`/api/v2/jobs/my/saved${suffix}`);
}
