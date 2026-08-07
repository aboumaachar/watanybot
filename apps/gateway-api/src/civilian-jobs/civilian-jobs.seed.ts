import type { CivilianOpportunity, OpportunitySource } from "./civilian-jobs.types";

export const civilianOpportunitySources: OpportunitySource[] = [
  { id: "manual", name: "Manual admin entry", url: "internal://manual", sourceType: "MANUAL", crawlPolicy: "MANUAL_ONLY", enabled: true, notes: "Initial trusted source for Wave 01." },
  { id: "daleel-madani", name: "Daleel Madani", url: "https://daleel-madani.org", sourceType: "NGO", crawlPolicy: "PUBLIC_ALLOWED_REVIEW_REQUIRED", enabled: false, notes: "NGO jobs, tenders, volunteering. Import requires review." },
  { id: "bayt-lebanon", name: "Bayt Lebanon", url: "https://www.bayt.com/en/lebanon/jobs/", sourceType: "JOB_BOARD", crawlPolicy: "RSS_OR_API_FIRST", enabled: false, notes: "Prefer API/feed/partner or manual import." },
  { id: "jobs-for-lebanon", name: "Jobs for Lebanon", url: "https://www.jobsforlebanon.com", sourceType: "JOB_BOARD", crawlPolicy: "RSS_OR_API_FIRST", enabled: false, notes: "Diaspora and remote work source; review terms before import." },
  { id: "tanqeeb-lebanon", name: "Tanqeeb Lebanon", url: "https://lebanon.tanqeeb.com", sourceType: "JOB_BOARD", crawlPolicy: "PUBLIC_ALLOWED_REVIEW_REQUIRED", enabled: false, notes: "Arabic job listings; import only through safe source policy." }
];

export const civilianOpportunitySeed: CivilianOpportunity[] = [
  {
    id: "opp-demo-security-supervisor",
    type: "PAID_JOB",
    audience: ["VETERAN", "FAMILY_MEMBER"],
    title: "Security Supervisor",
    organization: "Verified employer placeholder",
    location: "Lebanon",
    category: "Security and operations",
    summary: "Civilian job suitable for experienced veterans with supervision and operations background.",
    description: "Demo opportunity for Wave 01 only. Replace with admin-approved records or imported listings after review.",
    requirements: ["Operations experience", "Team supervision", "Arabic communication"],
    applicationMethod: "Apply inside WatanyBot. Admin review required before referral.",
    sourceName: "Manual admin entry",
    sourceUrl: "internal://manual",
    deadline: undefined,
    status: "PUBLISHED",
    adminVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "opp-demo-volunteer-logistics",
    type: "VOLUNTEER_WORK",
    audience: ["VETERAN", "SPOUSE", "CHILD", "FAMILY_MEMBER"],
    title: "Community Logistics Volunteer",
    organization: "Community partner placeholder",
    location: "Lebanon",
    category: "Volunteer and NGO support",
    summary: "Volunteer opportunity for logistics, event support, and community service.",
    description: "Demo volunteer opportunity for Wave 01. Publication remains admin-controlled.",
    requirements: ["Availability", "Basic coordination", "Commitment to attendance"],
    applicationMethod: "Register interest inside WatanyBot. Admin confirmation required.",
    sourceName: "Manual admin entry",
    sourceUrl: "internal://manual",
    deadline: undefined,
    status: "PUBLISHED",
    adminVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];