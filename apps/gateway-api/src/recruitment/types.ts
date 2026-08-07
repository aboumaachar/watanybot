import type { RecruitmentAnnouncement } from "@watany/types";

export interface RecruitmentStore {
  announcements: RecruitmentAnnouncement[];
}

export interface ResolvedRecruitmentQuery {
  kind: "announcement" | "recruitment";
  announcements: RecruitmentAnnouncement[];
  queryType: "listing" | "details";
  score: number;
  matchedApparatus: string[];
}