export type SocialPreview = {
  route: string;
  title: string;
  description: string;
  image: string;
  imageType: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  type: "article" | "website";
};

export const SOCIAL_PREVIEWS: readonly SocialPreview[] = [
  {
    route: "/jobs/middle-east-security",
    title: "فرصة عمل في الأمن والحماية — ميدل إيست سيكوريتي لبنان",
    description: "طلب انضمام إلى فريق ميدل إيست سيكوريتي لبنان بمعاش محترم وبحسب المؤهلات.",
    image: "/logo.png",
    imageType: "image/png",
    imageWidth: 1024,
    imageHeight: 1024,
    imageAlt: "ميدل إيست سيكوريتي لبنان",
    type: "article",
  },
  {
    route: "/jobs/accredited-bulldozer-driver/application/",
    title: "فرصة عمل – سائق جرافة معتمد",
    description: "طلب توظيف لسائق جرافة معتمد لصالح شركة لافاجيت في طرابلس والبداوي.",
    image: "/job-share-logo.jpg?v=20260928-2",
    imageType: "image/jpeg",
    imageWidth: 512,
    imageHeight: 512,
    imageAlt: "شعار موطني",
    type: "article",
  },
  {
    route: "/jobs/ainelhafeh",
    title: "إعلان عين الحفة",
    description: "اطّلع على تفاصيل إعلان عين الحفة وشروط التقديم والمواعيد والمعلومات الكاملة عبر موطني.",
    image: "/social/jobs/ainelhafeh-og.jpg",
    imageType: "image/jpeg",
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: "إعلان عين الحفة عبر موطني",
    type: "article",
  },
  {
    route: "/salary",
    title: "حاسبة المعاش",
    description: "احسب معاشك ومستحقاتك عبر حاسبة المعاش في موطني.",
    image: "/logo.png?v=20260827-1",
    imageType: "image/png",
    imageWidth: 1024,
    imageHeight: 1024,
    imageAlt: "شعار موطني لحاسبة المعاش",
    type: "website",
  },
];

export function getSocialPreview(route: string): SocialPreview | undefined {
  return SOCIAL_PREVIEWS.find((preview) => preview.route === route);
}
