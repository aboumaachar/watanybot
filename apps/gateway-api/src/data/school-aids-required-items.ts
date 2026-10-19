export type SchoolAidItemType = "FORM" | "GUIDE";
export type SchoolAidSourceStatus = "LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD" | "LOCAL_GUIDE" | "OFFICIAL_FILE_ATTACHED";
export type SchoolAidRequiredItem = {
  id: string; order: number; titleAr: string; type: SchoolAidItemType; descriptionAr: string;
  submitToAr: string; requiredForAr: string; previewUrl: string; downloadUrl: string;
  sourceStatus: SchoolAidSourceStatus; aliasesAr: string[];
  preferUniversal?: boolean;
};
const SCHOOL_AID_IMAGE_RE = /\.(?:png|jpe?g|webp)(?:$|[?#])/i;
export const schoolAidRequiredItems: SchoolAidRequiredItem[] = [
  { id:"school-aid-papers-conditions", order:2, titleAr:"الأوراق والشروط المطلوبة لتقديم المساعدة المدرسية", type:"GUIDE", descriptionAr:"قائمة إرشادية بالأوراق والشروط التي يجب تحضيرها قبل تقديم ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"تحضير الملف قبل التقديم", previewUrl:"/school-aids/guides/school-aid-papers-conditions.html", downloadUrl:"/school-aids/guides/school-aid-papers-conditions.html", sourceStatus:"LOCAL_GUIDE", aliasesAr:["الأوراق والشروط","المستندات المطلوبة","الشروط المطلوبة"] },
  { id:"annex-z", order:3, titleAr:"ملحق ز", type:"FORM", descriptionAr:"النموذج الأصلي المعروض كصورة فقط ضمن ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"إثبات أن الطالب مسجل في المدرسة", previewUrl:"/school-aids/forms/images/annex-z.jpg", downloadUrl:"/school-aids/forms/images/annex-z.jpg", sourceStatus:"OFFICIAL_FILE_ATTACHED", aliasesAr:["ملحق ز","الملحق ز","annex z"], preferUniversal:true },
  { id:"annex-j", order:4, titleAr:"ملحق ج", type:"FORM", descriptionAr:"النموذج الأصلي المعروض كصورة فقط ضمن ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"استكمال مستندات الطالب لدى الشؤون", previewUrl:"/school-aids/forms/images/annex-j.jpg", downloadUrl:"/school-aids/forms/images/annex-j.jpg", sourceStatus:"OFFICIAL_FILE_ATTACHED", aliasesAr:["ملحق ج","الملحق ج","annex j","annex c"], preferUniversal:true },
  { id:"school-year-completion-certificate", order:5, titleAr:"إفادة إنهاء العام الدراسي", type:"FORM", descriptionAr:"الإفادة الأصلية المعروضة كصورة فقط ضمن ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"إثبات إنهاء العام الدراسي", previewUrl:"/school-aids/forms/images/school-year-completion-certificate.jpg", downloadUrl:"/school-aids/forms/images/school-year-completion-certificate.jpg", sourceStatus:"OFFICIAL_FILE_ATTACHED", aliasesAr:["إفادة إنهاء العام الدراسي","افادة انهاء العام الدراسي"], preferUniversal:true }
];
export const schoolAidFormItems = schoolAidRequiredItems.filter((item) => item.type === "FORM" && SCHOOL_AID_IMAGE_RE.test(item.previewUrl) && SCHOOL_AID_IMAGE_RE.test(item.downloadUrl));
export const schoolAidGuideItems = schoolAidRequiredItems.filter((item) => item.type === "GUIDE");
export function getSchoolAidRequiredItem(itemId: string) { return schoolAidRequiredItems.find((item) => item.id === itemId); }
