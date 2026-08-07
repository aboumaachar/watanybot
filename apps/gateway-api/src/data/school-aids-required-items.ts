export type SchoolAidItemType = "FORM" | "GUIDE";
export type SchoolAidSourceStatus = "LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD" | "LOCAL_GUIDE" | "OFFICIAL_FILE_ATTACHED";
export type SchoolAidRequiredItem = {
  id: string; order: number; titleAr: string; type: SchoolAidItemType; descriptionAr: string;
  submitToAr: string; requiredForAr: string; previewUrl: string; downloadUrl: string;
  sourceStatus: SchoolAidSourceStatus; aliasesAr: string[];
  // If true, the frontend will open the universal in-app viewer shell even for non-HTML files
  preferUniversal?: boolean;
};
export const schoolAidRequiredItems: SchoolAidRequiredItem[] = [
  { id:"school-aid-application", order:1, titleAr:"طلب تقديم مساعدة مدرسية", type:"FORM", descriptionAr:"نموذج طلب المساعدة المدرسية الذي يقدمه صاحب العلاقة ضمن ملف المنح المدرسية.", submitToAr:"الشؤون", requiredForAr:"فتح أو استكمال ملف المساعدة المدرسية", previewUrl:"/school-aids/forms/school-aid-application.html", downloadUrl:"/school-aids/forms/school-aid-application.html", sourceStatus:"LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD", aliasesAr:["طلب مساعدة مدرسية","طلب تقديم مساعدة مدرسية"] },
  { id:"school-aid-papers-conditions", order:2, titleAr:"الأوراق والشروط المطلوبة لتقديم المساعدة المدرسية", type:"GUIDE", descriptionAr:"قائمة إرشادية بالأوراق والشروط التي يجب تحضيرها قبل تقديم ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"تحضير الملف قبل التقديم", previewUrl:"/school-aids/forms/school-aid-papers-conditions.html", downloadUrl:"/school-aids/forms/school-aid-papers-conditions.html", sourceStatus:"LOCAL_GUIDE", aliasesAr:["الأوراق والشروط","المستندات المطلوبة","الشروط المطلوبة"] },
  { id:"annex-z", order:3, titleAr:"ملحق ز", type:"FORM", descriptionAr:"نموذج يقدّم إلى الشؤون لإثبات/تأكيد انتساب الطالب إلى المدرسة بحسب ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"إثبات أن الطالب مسجل في المدرسة", previewUrl:"/school-aids/forms/annex-z.pdf", downloadUrl:"/school-aids/forms/annex-z.pdf", sourceStatus:"LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD", aliasesAr:["ملحق ز","الملحق ز","annex z"], preferUniversal: true },
  { id:"annex-j", order:4, titleAr:"ملحق ج", type:"FORM", descriptionAr:"نموذج يقدّم إلى الشؤون ضمن ملف المنح المدرسية لإثبات/تأكيد وضع الطالب المدرسي.", submitToAr:"الشؤون", requiredForAr:"استكمال مستندات الطالب لدى الشؤون", previewUrl:"/school-aids/forms/annex-j.pdf", downloadUrl:"/school-aids/forms/annex-j.pdf", sourceStatus:"LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD", aliasesAr:["ملحق ج","الملحق ج","annex j","annex c"], preferUniversal: true },
  { id:"school-year-completion-certificate", order:5, titleAr:"إفادة إنهاء العام الدراسي", type:"FORM", descriptionAr:"إفادة تثبت إنهاء الطالب للعام الدراسي وتُستعمل عند طلبها ضمن ملف المساعدة المدرسية.", submitToAr:"الشؤون", requiredForAr:"إثبات إنهاء العام الدراسي", previewUrl:"/school-aids/forms/school-year-completion-certificate.pdf", downloadUrl:"/school-aids/forms/school-year-completion-certificate.pdf", sourceStatus:"LOCAL_TEMPLATE_NEEDS_OFFICIAL_UPLOAD", aliasesAr:["إفادة إنهاء العام الدراسي","افادة انهاء العام الدراسي"], preferUniversal: true }
];
export const schoolAidFormItems = schoolAidRequiredItems.filter((item) => item.type === "FORM");
export const schoolAidGuideItems = schoolAidRequiredItems.filter((item) => item.type === "GUIDE");
export function getSchoolAidRequiredItem(itemId: string) { return schoolAidRequiredItems.find((item) => item.id === itemId); }
