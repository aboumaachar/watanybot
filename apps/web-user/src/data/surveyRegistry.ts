export type WatanySurveyEntry = Readonly<{
  id: string;
  title: string;
  summary: string;
  route: string;
  publishedAt: string;
  status: "open" | "closed";
  audience: string;
}>;

export const watanySurveyRegistry: readonly WatanySurveyEntry[] = [
  {
    id: "veterans-2019-survey",
    title: "استمارة حصر حالات العسكريين المتقاعدين 2019",
    summary: "توثيق حالات العسكريين المحالين إلى التقاعد خلال عام 2019 وبيانات دخول التعويضات التقاعدية إلى الحساب المصرفي.",
    route: "/veterans-2019/",
    publishedAt: "2026-09-30T00:00:00+03:00",
    status: "closed",
    audience: "العسكريون المحالون إلى التقاعد خلال عام 2019",
  },
];

export const activeWatanySurveys = watanySurveyRegistry
  .filter((survey) => survey.status === "open")
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
