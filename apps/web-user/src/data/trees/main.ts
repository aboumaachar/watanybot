/**
 * Main menu decision tree — the primary navigation tree for the app.
 */
import type { DecisionTree } from "@watany/types";

export const mainTree: DecisionTree = {
  id: "main",
  name: "القائمة الرئيسية",
  rootNodeId: "root",
  nodes: {
    root: {
      id: "root",
      type: "question",
      title: "كيف بقدر ساعدك اليوم؟",
      body: "اختر من الخيارات التالية أو اكتب سؤالك مباشرة",
      buttons: [
        { label: "محادثة موطني", icon: "chat", nextNodeId: "freeform" },
        { label: "معاملاتي وطلباتي", icon: "document", nextNodeId: "procedures" },
        { label: "الصحة والاستشفاء", icon: "health", nextNodeId: "health" },
        { label: "المستندات والإفادات", icon: "document", nextNodeId: "documents" },
        { label: "النماذج الرسمية", icon: "folder", nextNodeId: "forms" },
        { label: "التطويع", icon: "megaphone", nextNodeId: "recruitment" },
        { label: "السوق المجتمعي", icon: "apps", nextNodeId: "marketplace" },
        { label: "الدليل", icon: "building", nextNodeId: "directory" },
        { label: "مصارف الدفع", icon: "payment", nextNodeId: "directory_banks_open" },
        { label: "القوانين والحقوق", icon: "scale", nextNodeId: "legal" },
      ],
    },

    salary: {
      id: "salary",
      type: "action",
      title: "حاسبة المعاش",
      body: "سيتم فتح حاسبة المعاش الآن.",
      buttons: [],
      resultText: "يرجى فتح حاسبة المعاش من القائمة الجانبية.",
    },

    cases: {
      id: "cases",
      type: "question",
      title: "ما نوع المعاملة؟",
      buttons: [
        { label: "👨‍👩‍👧‍👦 معاملة ذوي", nextNodeId: "case_dependents" },
        { label: "💀 وفاة / إرث", nextNodeId: "case_death" },
        { label: "🏥 طبية", nextNodeId: "case_medical" },
        { label: "🎓 تعليمية", nextNodeId: "case_schooling" },
        { label: "💰 صرف معاش", nextNodeId: "case_pension" },
        { label: "📝 أخرى", nextNodeId: "case_other" },
      ],
    },

    case_dependents: {
      id: "case_dependents",
      type: "result",
      title: "معاملة ذوي",
      buttons: [],
      resultText: "المستندات المطلوبة:\n• إخراج قيد عائلي\n• صورة عن الهوية\n• إفادة عسكرية\n• طلب خطي\n\nتُقدَّم المعاملة لدى مديرية شؤون الأفراد.",
    },

    case_death: {
      id: "case_death",
      type: "result",
      title: "معاملة وفاة / إرث",
      buttons: [],
      resultText: "المستندات المطلوبة:\n• شهادة وفاة\n• حصر إرث\n• إخراج قيد عائلي\n• وكالة شرعية\n\nتُراجَع مديرية شؤون الأفراد.",
    },

    case_medical: {
      id: "case_medical",
      type: "result",
      title: "معاملة طبية",
      buttons: [],
      resultText: "المستندات المطلوبة:\n• تقرير طبي\n• وصفة طبية\n• فواتير\n• إفادة عسكرية\n\nتُقدَّم لدى الشعبة الطبية.",
    },

    case_schooling: {
      id: "case_schooling",
      type: "result",
      title: "معاملة تعليمية",
      buttons: [],
      resultText: "المستندات المطلوبة:\n• إفادة مدرسية / جامعية\n• إخراج قيد عائلي\n• إفادة عسكرية\n\nتُقدَّم للحصول على المساعدات المدرسية.",
    },

    case_pension: {
      id: "case_pension",
      type: "result",
      title: "معاملة صرف معاش",
      buttons: [],
      resultText: "لصرف المعاش التقاعدي:\n• مراجعة صندوق التقاعد\n• إفادة حياة\n• هوية أو جواز سفر\n\nيُصرف المعاش شهرياً عبر المصرف المعتمد.",
    },

    case_other: {
      id: "case_other",
      type: "result",
      title: "معاملة أخرى",
      buttons: [],
      resultText: "يمكنك وصف معاملتك في المحادثة وسنساعدك بالخطوات اللازمة.",
    },

    forms: {
      id: "forms",
      type: "question",
      title: "الإجراءات والنماذج المرتبطة",
      buttons: [
        { label: "📋 طلبات عامة", nextNodeId: "forms_general" },
        { label: "🏥 نماذج طبية", nextNodeId: "forms_medical" },
        { label: "💰 نماذج مالية", nextNodeId: "forms_financial" },
        { label: "👨‍👩‍👧 نماذج عائلية", nextNodeId: "forms_family" },
      ],
    },

    forms_general: {
      id: "forms_general",
      type: "result",
      title: "طلبات عامة",
      buttons: [
        { label: "فتح نماذج الجيش", nextNodeId: "forms_general_open" },
        { label: "كل النماذج الرسمية", nextNodeId: "forms_catalog_open" },
      ],
      resultText: "المستندات المتاحة:\n• طلب إفادة عسكرية\n• طلب نقل ملف\n• طلب تصحيح بيانات\n\nاختر المسار المناسب للمتابعة المباشرة.",
    },

    forms_medical: {
      id: "forms_medical",
      type: "result",
      title: "نماذج طبية",
      buttons: [
        { label: "فتح نماذج الطبابة", nextNodeId: "forms_medical_open" },
        { label: "كل النماذج الرسمية", nextNodeId: "forms_catalog_open" },
      ],
      resultText: "المستندات المتاحة:\n• طلب تعويض طبي\n• تقرير لجنة طبية\n• طلب استشفاء\n\nافتح المكتبة مباشرة للوصول إلى النماذج الطبية الرسمية.",
    },

    forms_financial: {
      id: "forms_financial",
      type: "result",
      title: "نماذج مالية",
      buttons: [
        { label: "إفادة الراتب", nextNodeId: "pension_attestation_open" },
        { label: "نماذج التقاعد", nextNodeId: "forms_financial_open" },
      ],
      resultText: "المستندات المتاحة:\n• طلب صرف معاش\n• إفادة راتب\n• طلب سلفة\n\nيمكنك متابعة إفادة الراتب أو فتح نماذج التقاعد مباشرة.",
    },

    forms_family: {
      id: "forms_family",
      type: "result",
      title: "نماذج عائلية",
      buttons: [
        { label: "الوضع العائلي والتقاعد", nextNodeId: "forms_family_open" },
        { label: "كل النماذج الرسمية", nextNodeId: "forms_catalog_open" },
      ],
      resultText: "المستندات المتاحة:\n• طلب تسجيل زواج\n• طلب إضافة مولود\n• طلب مساعدة تعليمية\n\nافتح المسار الأنسب لمتابعة النماذج العائلية مباشرة.",
    },

    forms_catalog_open: {
      id: "forms_catalog_open",
      type: "action",
      title: "مكتبة النماذج",
      body: "يتم فتح مكتبة النماذج الرسمية الآن.",
      buttons: [],
    },

    forms_general_open: {
      id: "forms_general_open",
      type: "action",
      title: "نماذج الجيش",
      body: "يتم فتح نماذج الجيش الآن.",
      buttons: [],
    },

    forms_medical_open: {
      id: "forms_medical_open",
      type: "action",
      title: "نماذج الطبابة",
      body: "يتم فتح نماذج الطبابة الآن.",
      buttons: [],
    },

    forms_financial_open: {
      id: "forms_financial_open",
      type: "action",
      title: "نماذج التقاعد",
      body: "يتم فتح نماذج التقاعد الآن.",
      buttons: [],
    },

    forms_family_open: {
      id: "forms_family_open",
      type: "action",
      title: "نماذج الوضع العائلي",
      body: "يتم فتح النماذج العائلية المرتبطة بالتقاعد الآن.",
      buttons: [],
    },

    pension_attestation_open: {
      id: "pension_attestation_open",
      type: "action",
      title: "إفادة الراتب",
      body: "يتم فتح إفادة الراتب الآن.",
      buttons: [],
    },

    finance: {
      id: "finance",
      type: "action",
      title: "المعاشات والمستحقات",
      body: "يتم فتح صفحة المعاشات والمستحقات الآن.",
      buttons: [],
    },

    health: {
      id: "health",
      type: "action",
      title: "الصحة والاستشفاء",
      body: "يتم فتح صفحة الصحة والاستشفاء الآن.",
      buttons: [],
    },

    documents: {
      id: "documents",
      type: "action",
      title: "المستندات والإفادات",
      body: "يتم فتح صفحة المستندات والإفادات الآن.",
      buttons: [],
    },

    recruitment: {
      id: "recruitment",
      type: "action",
      title: "التطويع",
      body: "يتم فتح صفحة التطويع الآن.",
      buttons: [],
    },

    marketplace: {
      id: "marketplace",
      type: "action",
      title: "السوق المجتمعي",
      body: "يتم فتح صفحة السوق المجتمعي الآن.",
      buttons: [],
    },

    directory: {
      id: "directory",
      type: "action",
      title: "الدليل",
      body: "يتم فتح صفحة الدليل الآن.",
      buttons: [],
    },

    directory_banks_open: {
      id: "directory_banks_open",
      type: "action",
      title: "مصارف الدفع",
      body: "يتم فتح دليل المصارف وخدمات الدفع الآن.",
      buttons: [],
    },

    legal: {
      id: "legal",
      type: "action",
      title: "القوانين والحقوق",
      body: "يتم فتح صفحة القوانين والحقوق الآن.",
      buttons: [],
    },

    procedures: {
      id: "procedures",
      type: "action",
      title: "الإجراءات",
      body: "سيتم فتح صفحة الإجراءات الرئيسية",
      buttons: [],
    },

    faq: {
      id: "faq",
      type: "action",
      title: "الأسئلة الشائعة",
      body: "سيتم فتح صفحة الأسئلة الشائعة",
      buttons: [],
    },

    medical: {
      id: "medical",
      type: "question",
      title: "خدمات طبية",
      buttons: [
        { label: "🏥 استشفاء", nextNodeId: "medical_hospital" },
        { label: "💊 أدوية", nextNodeId: "medical_meds" },
        { label: "🦷 أسنان", nextNodeId: "medical_dental" },
      ],
    },

    medical_hospital: {
      id: "medical_hospital",
      type: "result",
      title: "استشفاء",
      buttons: [],
      resultText: "للاستشفاء:\n• مراجعة المستشفى العسكري\n• إبراز البطاقة العسكرية\n• تقديم تحويل من الطبيب\n\nالمستشفى العسكري المركزي: 01-000000",
    },

    medical_meds: {
      id: "medical_meds",
      type: "result",
      title: "أدوية",
      buttons: [],
      resultText: "لصرف الاستفسار عن الأدوية:\n• وصفة طبية من طبيب الجيش\n• مراجعة صيدلية المستشفى العسكري\n• بعض الاستفسار عن الأدوية تحتاج موافقة مسبقة",
    },

    medical_dental: {
      id: "medical_dental",
      type: "result",
      title: "أسنان",
      buttons: [],
      resultText: "لعلاج الأسنان:\n• مراجعة عيادة الأسنان في المستشفى العسكري\n• أو تقديم فواتير من عيادة خاصة\n• السقف: حسب الرتبة والحالة",
    },

    freeform: {
      id: "freeform",
      type: "action",
      title: "سؤال حر",
      body: "اكتب سؤالك وسأحاول مساعدتك",
      buttons: [],
    },
  },
};
