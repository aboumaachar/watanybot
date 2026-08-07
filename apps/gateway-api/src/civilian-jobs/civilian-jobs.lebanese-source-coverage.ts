export type LebaneseJobSourceCategory =
  | "JOB_BOARD"
  | "NGO"
  | "UN_NGO"
  | "RECRUITER"
  | "UNIVERSITY"
  | "HOSPITAL"
  | "BANK"
  | "TELECOM"
  | "COMPANY"
  | "PUBLIC"
  | "SOCIAL_MANUAL";

export type LebaneseJobSourcePriority = "HIGH" | "MEDIUM" | "LOW";

export interface LebaneseJobSourceDefinition {
  sourceId: string;
  category: LebaneseJobSourceCategory;
  name: string;
  url: string;
  priority: LebaneseJobSourcePriority;
  crawlFrequency: "DAILY_IF_ALLOWED" | "MANUAL_ONLY";
  autoPublish: false;
  adminReviewRequired: true;
  policyNote: string;
  tags: string[];
}

export const LEBANESE_JOB_SOURCE_REGISTRY: LebaneseJobSourceDefinition[] = [
  { sourceId: "bayt-lebanon", category: "JOB_BOARD", name: "Bayt Lebanon", url: "https://www.bayt.com/en/lebanon/jobs/", priority: "HIGH", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Adapter must respect terms/robots and import to review queue only.", tags: ["jobs", "private-sector"] },
  { sourceId: "tanqeeb-lebanon", category: "JOB_BOARD", name: "Tanqeeb Lebanon", url: "https://lebanon.tanqeeb.com/", priority: "HIGH", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Adapter must respect terms/robots and import to review queue only.", tags: ["jobs", "arabic"] },
  { sourceId: "jobs-for-lebanon", category: "JOB_BOARD", name: "Jobs for Lebanon", url: "https://www.jobsforlebanon.com/", priority: "HIGH", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Adapter must respect terms/robots and import to review queue only.", tags: ["diaspora", "jobs"] },
  { sourceId: "daleel-madani", category: "NGO", name: "Daleel Madani Jobs", url: "https://daleel-madani.org/jobs", priority: "HIGH", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Strong NGO/volunteer relevance; import to review queue only.", tags: ["ngo", "volunteer", "civil-society"] },
  { sourceId: "unjobs-lebanon", category: "UN_NGO", name: "UNJobs Lebanon", url: "https://unjobs.org/duty_stations/lebanon", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "UN/INGO jobs; verify source page before import.", tags: ["un", "ingo"] },
  { sourceId: "khoubourat", category: "RECRUITER", name: "Khoubourat", url: "https://hr.khoubourat.org.lb/", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Recruiter source; dedupe carefully.", tags: ["recruiter"] },
  { sourceId: "bso-recruitment", category: "RECRUITER", name: "BSO Recruitment", url: "https://www.bso.com.lb/", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Recruiter source; dedupe carefully.", tags: ["recruiter"] },
  { sourceId: "aub-careers", category: "UNIVERSITY", name: "AUB Careers", url: "https://www.aub.edu.lb/", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Career page discovery may require manual adapter.", tags: ["university"] },
  { sourceId: "lau-careers", category: "UNIVERSITY", name: "LAU Careers", url: "https://www.lau.edu.lb/", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Career page discovery may require manual adapter.", tags: ["university"] },
  { sourceId: "aubmc-careers", category: "HOSPITAL", name: "AUBMC Careers", url: "https://www.aubmc.org.lb/", priority: "MEDIUM", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Hospital careers adapter candidate.", tags: ["hospital", "healthcare"] },
  { sourceId: "alfa-careers", category: "TELECOM", name: "Alfa Careers", url: "https://www.alfa.com.lb/", priority: "LOW", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Company career page; may not always expose structured listings.", tags: ["telecom"] },
  { sourceId: "touch-careers", category: "TELECOM", name: "touch Careers", url: "https://www.touch.com.lb/", priority: "LOW", crawlFrequency: "DAILY_IF_ALLOWED", autoPublish: false, adminReviewRequired: true, policyNote: "Company career page; may not always expose structured listings.", tags: ["telecom"] },
  { sourceId: "manual-facebook-instagram-whatsapp", category: "SOCIAL_MANUAL", name: "Social/manual intake queue", url: "manual://social-intake", priority: "HIGH", crawlFrequency: "MANUAL_ONLY", autoPublish: false, adminReviewRequired: true, policyNote: "Never scrape private groups/chats. Admin/manual submission only.", tags: ["manual", "social"] }
];

export function listLebaneseJobSources(): LebaneseJobSourceDefinition[] {
  return LEBANESE_JOB_SOURCE_REGISTRY.slice();
}

export function findLebaneseJobSource(sourceId: string): LebaneseJobSourceDefinition | undefined {
  return LEBANESE_JOB_SOURCE_REGISTRY.find((source) => source.sourceId === sourceId);
}