export type RecruitmentInstitution =
  | "army"
  | "isf"
  | "general_security"
  | "state_security"
  | "customs"
  | "civil_defense"
  | "other";

export type RecruitmentAnnouncementStatus =
  | "draft"
  | "published"
  | "open"
  | "closed"
  | "archived";

export type RecruitmentAnnouncementSourceType =
  | "official_website"
  | "official_pdf"
  | "official_social_post"
  | "manual_verified";

export type RecruitmentAnnouncement = {
  id: string;
  title: string;
  institution: RecruitmentInstitution;
  status: RecruitmentAnnouncementStatus;
  sourceType: RecruitmentAnnouncementSourceType;
  sourceUrl?: string;
  attachmentUrl?: string;
  publishedAt?: string;
  deadlineAt?: string;
  targetGroup?: string;
  conditions?: string[];
  requiredDocuments?: string[];
  applicationMethod?: string;
  summary?: string;
  fullText?: string;
  createdAt: string;
  updatedAt: string;
};

export const RECRUITMENT_INSTITUTION_LABELS: Record<RecruitmentInstitution, string> = {
  army: "الجيش اللبناني",
  isf: "قوى الأمن الداخلي",
  general_security: "الأمن العام",
  state_security: "أمن الدولة",
  customs: "الجمارك",
  civil_defense: "الدفاع المدني",
  other: "جهة رسمية أخرى"
};

export const RECRUITMENT_STATUS_LABELS: Record<RecruitmentAnnouncementStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  open: "مفتوح حالياً",
  closed: "منتهي",
  archived: "مؤرشف"
};

export function hasRecruitmentSourceEvidence(
  item: Pick<RecruitmentAnnouncement, "sourceType" | "sourceUrl" | "attachmentUrl">
): boolean {
  return Boolean(item.sourceUrl || item.attachmentUrl || item.sourceType === "manual_verified");
}
