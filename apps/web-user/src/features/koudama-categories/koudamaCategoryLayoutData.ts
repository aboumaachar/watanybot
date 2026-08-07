// APEX DEMO01 ALL ICONS LAYOUT DATA
// Theme-safe: Arabic category data only. No theme, palette, CSS, or global styling changes.

export type KoudamaCategoryItem = {
  readonly label: string;
  readonly icon: string;
  readonly locked?: boolean;
};

export type KoudamaCategoryGroup = {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  readonly items: readonly KoudamaCategoryItem[];
};

export const koudamaDemo01CategoryGroups: readonly KoudamaCategoryGroup[] = [
  {
    key: 'account',
    title: 'حسابي',
    subtitle: 'الملف الشخصي، العائلة، المستندات، والإدارة',
    icon: '👤',
    items: [
      { label: 'تسجيل الدخول', icon: '🔐' },
      { label: 'إنشاء حساب', icon: '✨' },
      { label: 'الملف الشخصي', icon: '🪪' },
      { label: 'أفراد العائلة', icon: '👨‍👩‍👧' },
      { label: 'مستنداتي', icon: '📁' },
      { label: 'الإشعارات', icon: '🔔' },
      { label: 'لوحة الإدارة', icon: '🛡️' },
      { label: 'الأدوار والصلاحيات', icon: '🧩' },
      { label: 'سجل النشاطات', icon: '🧾' },
    ],
  },
  {
    key: 'services',
    title: 'الخدمات',
    subtitle: 'إجراءات وخدمات عملية يحتاجها المستخدم يومياً',
    icon: '🏛️',
    items: [
      { label: 'القوانين والإجراءات', icon: '📜' },
      { label: 'المستندات المطلوبة', icon: '📄' },
      { label: 'الشبكة', icon: '🕸️' },
      { label: 'اختيار المحافظة', icon: '📍' },
      { label: 'اختيار القضاء', icon: '🗺️' },
      { label: 'اختيار البلدة', icon: '🏘️' },
      { label: 'الوظائف', icon: '💼' },
      { label: 'السوق', icon: '🛒' },
      { label: 'التصويت', icon: '🗳️' },
    ],
  },
  {
    key: 'watany',
    title: 'اسأل موطني',
    subtitle: 'المساعد الذكي العربي المخصص للعسكريين المتقاعدين وعائلاتهم',
    icon: '💬',
    items: [
      { label: 'سؤال جديد', icon: '✍️' },
      { label: 'التقاعد والتعويضات', icon: '🎖️' },
      { label: 'الطبابة', icon: '🏥' },
      { label: 'المدارس والمنح', icon: '🎓' },
      { label: 'الإجراءات والمستندات', icon: '📑' },
      { label: 'الأسئلة الشائعة', icon: '❓' },
      { label: 'أكثر الأسئلة تداولاً', icon: '🔥' },
      { label: 'مجموعات الدردشة', icon: '👥' },
      { label: 'او شي تاني', icon: '➕' },
    ],
  },
  {
    key: 'tools',
    title: 'الأدوات',
    subtitle: 'حاسبات، بحث، مستندات، وحالة الدفعات',
    icon: '🧰',
    items: [
      { label: 'حاسبة الراتب والتقاعد', icon: '🧮' },
      { label: 'البحث في مكتبة المعرفة', icon: '🔎' },
      { label: 'حالة الدفعات والتعويضات', icon: '💳' },
      { label: 'معاينة PDF', icon: '📕' },
      { label: 'تحميل مستند', icon: '⬇️' },
      { label: 'مشاركة رابط', icon: '🔗' },
      { label: 'حفظ في حسابي', icon: '💾' },
      { label: 'تثبيت التطبيق على الهاتف', icon: '📱' },
      { label: 'وضع الاستخدام السهل', icon: '♿' },
    ],
  },
  {
    key: 'entertainment',
    title: 'الترفيه',
    subtitle: 'محتوى خفيف، نشاطات، ومسابقات المجتمع',
    icon: '🎉',
    items: [
      { label: 'كأس العالم — جاهز ومغلق', icon: '🏆', locked: true },
      { label: 'المباريات', icon: '⚽', locked: true },
      { label: 'التوقعات', icon: '🔮', locked: true },
      { label: 'نشاطات المجتمع', icon: '🎪' },
      { label: 'أخبار خفيفة', icon: '📰' },
      { label: 'مناسبات', icon: '📅' },
      { label: 'فعاليات', icon: '🎤' },
      { label: 'مسابقات خفيفة', icon: '🎯' },
      { label: 'نتائج المجتمع', icon: '📊' },
    ],
  },
] as const;