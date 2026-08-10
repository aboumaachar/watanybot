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
];

export function getSocialPreview(route: string): SocialPreview | undefined {
  return SOCIAL_PREVIEWS.find((preview) => preview.route === route);
}
