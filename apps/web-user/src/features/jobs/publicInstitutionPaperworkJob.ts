export type WatanyJobSeed = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  settingAr: string;
  audienceAr: string[];
  summaryAr: string;
  summaryEn: string;
  responsibilitiesAr: string[];
  requirementsAr: string[];
  veteranBenefitAr: string[];
  complianceNotesAr: string[];
  searchKeywordsAr: string[];
  ctaAr: string;
  ctaEn: string;
};

export const publicInstitutionPaperworkJob: WatanyJobSeed = {
  id: 'watany-job-public-institution-paperwork-expeditor',
  slug: 'taqib-muamalat-public-institutions',
  titleAr: 'تعقيب معاملات',
  titleEn: 'Public Institution Paperwork Follow-up',
  categoryAr: 'خدمات عامة ومساندة إدارية',
  categoryEn: 'Public service and administrative support',
  settingAr: 'المؤسسات والإدارات العامة',
  audienceAr: ['قدامى العسكريين', 'عائلات العسكريين المتقاعدين', 'المستفيدون الذين يحتاجون مساعدة في إنجاز المعاملات'],
  summaryAr: 'وظيفة ميدانية لمساعدة قدامى العسكريين وعائلاتهم في متابعة المعاملات الورقية داخل المؤسسات والإدارات العامة بطريقة منظمة ومحترمة وشفافة.',
  summaryEn: 'A field support role helping veterans and their families follow up paperwork inside public institutions in an organized, respectful, and transparent way.',
  responsibilitiesAr: [
    'استقبال طلبات المساعدة المتعلقة بالمعاملات الورقية وتحديد نوع المعاملة والمستندات المطلوبة.',
    'مساعدة المستفيد على تجهيز الملف قبل التوجه إلى المؤسسة العامة المعنية.',
    'مرافقة أو متابعة المعاملة في الإدارات العامة عندما يكون ذلك مسموحاً قانونياً وإدارياً.',
    'تحديث حالة المعاملة للمستفيد بشكل واضح: ناقصة، قيد المتابعة، بحاجة إلى مستند إضافي، أو منجزة.',
    'إرشاد المستفيد إلى النافذة أو الدائرة الصحيحة وتخفيف التنقل غير الضروري بين الإدارات.',
    'تسجيل الملاحظات والأسئلة الشائعة التي يجب إضافتها لاحقاً إلى قاعدة معرفة موطني.'
  ],
  requirementsAr: [
    'معرفة جيدة بإجراءات الإدارات والمؤسسات العامة في لبنان.',
    'قدرة على التعامل الهادئ والمحترم مع كبار السن وعائلات العسكريين المتقاعدين.',
    'مهارة تنظيم الملفات والمستندات ومتابعة الحالات.',
    'التزام كامل بالشفافية وعدم تقديم وعود غير مضمونة أو غير قانونية.',
    'قدرة على استخدام الهاتف أو التطبيق لتحديث حالة المعاملة.'
  ],
  veteranBenefitAr: [
    'تقليل الوقت والانتظار على قدامى العسكريين وعائلاتهم.',
    'تخفيف الأخطاء الناتجة عن نقص المستندات أو الذهاب إلى دائرة غير مناسبة.',
    'تقديم مساعدة عملية مرتبطة مباشرة بخدمات موطني الأساسية.',
    'تحويل الأسئلة المتكررة إلى معرفة منظمة داخل النظام.'
  ],
  complianceNotesAr: [
    'الدور هو مساعدة ومتابعة وإرشاد، وليس تجاوزاً للإجراءات الرسمية.',
    'يجب عدم طلب أو قبول أي بدل غير مصرح به أو غير موثق.',
    'يجب حفظ خصوصية المستفيدين وعدم مشاركة المستندات إلا مع الجهة المخولة.',
    'أي حالة تتطلب قراراً قانونياً أو طبياً أو مالياً يجب تحويلها إلى الجهة المختصة.'
  ],
  searchKeywordsAr: ['تعقيب معاملات', 'معاملات', 'إدارات عامة', 'مؤسسات عامة', 'أوراق', 'ملف', 'قدامى العسكريين', 'متابعة معاملة'],
  ctaAr: 'اطلب مساعدة في معاملة',
  ctaEn: 'Request paperwork support'
};

export default publicInstitutionPaperworkJob;