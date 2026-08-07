export const SCHOOL_FORM_ICONS = {
  "university-form": {
    featureId: "school-forms-university-form",
    labelAr: "نموذج الجامعة",
    path: "/watany-v4/icons/school-forms/university-form.png",
    sha256: "8AC8A7800509C4D1485B658B3E8713A8D3C9CB50F9614317B9C530202470A662",
  },
  "school-form": {
    featureId: "school-forms-school-form",
    labelAr: "نموذج المدرسة",
    path: "/watany-v4/icons/school-forms/school-form.png",
    sha256: "6958B88588B8B5F1EEA28F97D6CCCF16C2093DC776DD9E14809B049C088590C0",
  },
  "ministerial-decision": {
    featureId: "school-forms-ministerial-decision",
    labelAr: "القرار الوزاري",
    path: "/watany-v4/icons/school-forms/ministerial-decision.png",
    sha256: "0E95A670AFA9C0C0888538888E0E0E5F3B69048E8E00A5FEBF65D6476E4D09BC",
  },
  "generic-application-form": {
    featureId: "school-forms-generic-application-form",
    labelAr: "نموذج الطلب العام",
    path: "/watany-v4/icons/school-forms/generic-application-form.png",
    sha256: "AFE6A76F013FF448EEA16A32A3FCA3A04887A81828E12FEE20266489355AA069",
  },
} as const;

export type SchoolFormIconName = keyof typeof SCHOOL_FORM_ICONS;

export type SchoolFormIconDefinition = (typeof SCHOOL_FORM_ICONS)[SchoolFormIconName];

export function getSchoolFormIcon(name: SchoolFormIconName): SchoolFormIconDefinition {
  return SCHOOL_FORM_ICONS[name];
}