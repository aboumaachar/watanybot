/* ── Job Search Feature – Seed data ──────────────────── */
import type {
  JobCategory,
  Employer,
  JobPosting,
  JobApplicationRecord,
  SavedJob,
} from "./types.js";

/* ── Categories ──────────────────────────────────────── */

export const SEED_CATEGORIES: JobCategory[] = [
  { id: 1,  name_ar: "الأمن والحراسة",       name_en: "Security & Protection",     icon: "ph-fill ph-shield-checkered",   description_ar: "وظائف في مجال الأمن والحماية" },
  { id: 2,  name_ar: "النقل والسياقة",        name_en: "Transportation & Driving",   icon: "ph-fill ph-truck",              description_ar: "وظائف سائقين ونقل" },
  { id: 3,  name_ar: "الصيانة والإصلاح",      name_en: "Maintenance & Repair",       icon: "ph-fill ph-wrench",             description_ar: "وظائف الصيانة الفنية" },
  { id: 4,  name_ar: "الإدارة والمكتب",       name_en: "Administration & Office",    icon: "ph-fill ph-briefcase",          description_ar: "وظائف إدارية ومكتبية" },
  { id: 5,  name_ar: "التكنولوجيا",           name_en: "Technology & IT",            icon: "ph-fill ph-laptop",             description_ar: "وظائف تقنية وتكنولوجيا المعلومات" },
  { id: 6,  name_ar: "التعليم والتدريب",      name_en: "Education & Training",       icon: "ph-fill ph-graduation-cap",     description_ar: "وظائف تعليمية وتدريبية" },
  { id: 7,  name_ar: "الصحة والطب",           name_en: "Healthcare",                 icon: "ph-fill ph-hospital",           description_ar: "وظائف في القطاع الصحي" },
  { id: 8,  name_ar: "البناء والمقاولات",     name_en: "Construction",               icon: "ph-fill ph-hard-hat",           description_ar: "وظائف في مجال البناء" },
  { id: 9,  name_ar: "الضيافة والسياحة",      name_en: "Hospitality & Tourism",      icon: "ph-fill ph-building",           description_ar: "وظائف الفنادق والسياحة" },
  { id: 10, name_ar: "المبيعات والتسويق",     name_en: "Sales & Marketing",          icon: "ph-fill ph-chart-line",         description_ar: "وظائف المبيعات والترويج" },
];

/* ── Employers ───────────────────────────────────────── */

export const SEED_EMPLOYERS: Employer[] = [
  {
    id: "emp_001",
    company_name: "الشركة اللبنانية للحراسة والأمن",
    company_name_en: "Lebanese Security Services",
    industry: "أمن",
    company_size: "51-200",
    email: "hr@lss-lb.com",
    phone: "+961-1-234567",
    city: "بيروت",
    description_ar: "شركة رائدة في خدمات الأمن والحراسة، تفضّل المتقاعدين العسكريين",
    verified: true,
    veteran_friendly: true,
  },
  {
    id: "emp_002",
    company_name: "مكتب خدمات المجتمع",
    company_name_en: "Community Services Office",
    industry: "خدمات اجتماعية",
    company_size: "11-50",
    email: "jobs@cso-lb.org",
    phone: "+961-1-345678",
    city: "طرابلس",
    description_ar: "منظمة غير ربحية لدعم المحاربين القدامى وعائلاتهم",
    verified: true,
    veteran_friendly: true,
  },
  {
    id: "emp_003",
    company_name: "شركة النقل والتوزيع",
    company_name_en: "Transport & Distribution Co.",
    industry: "نقل",
    company_size: "11-50",
    email: "hr@transport-lb.com",
    city: "صيدا",
    description_ar: "شركة نقل وتوصيل ولوجستيات",
    verified: true,
    veteran_friendly: false,
  },
  {
    id: "emp_004",
    company_name: "المستشفى العسكري",
    company_name_en: "Military Hospital",
    industry: "صحة",
    company_size: "201-500",
    email: "hr@milhosp.gov.lb",
    city: "بيروت",
    description_ar: "المستشفى العسكري المركزي",
    verified: true,
    veteran_friendly: true,
  },
  {
    id: "emp_005",
    company_name: "تكنولوجيا الشرق",
    company_name_en: "EastTech Solutions",
    industry: "تكنولوجيا",
    company_size: "11-50",
    email: "careers@easttech.lb",
    city: "بيروت",
    description_ar: "شركة تقنية متخصصة في الحلول الأمنية الرقمية",
    verified: true,
    veteran_friendly: true,
  },
];

/* ── Job Postings ────────────────────────────────────── */

export const SEED_JOBS: JobPosting[] = [];

/* ── Mutable stores (in-memory) ──────────────────────── */

export const applications: JobApplicationRecord[] = [];
export const savedJobs: SavedJob[] = [];
