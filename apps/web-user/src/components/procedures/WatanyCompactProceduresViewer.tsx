import { type CSSProperties, useMemo, useState } from 'react';
import { openWatanyUniversalFormViewer } from '../../lib/watanyUniversalFormViewer';
import '../../styles/watany-compact-procedures-viewer.css';

type ProcedureSource = 'all' | 'mof' | 'laf';

type ProcedureForm = {
  code: string;
  title: string;
  previewUrl?: string;
  downloadUrl?: string;
};

type ProcedureItem = {
  id: string;
  source: 'mof' | 'laf';
  sourceTitle: string;
  icon: string;
  title: string;
  subtitle: string;
  badges: string[];
  requirements: string[];
  steps: string[];
  forms?: ProcedureForm[];
  primaryLabel: string;
  href?: string;
  endpointLabel: string;
  defaultVisible: boolean;
  searchOnlyReason?: string;
  keywords?: string[];
};

const forms: Record<string, ProcedureForm> = {
  'ت7': {
    code: 'ت7',
    title: 'طلب إعادة تخصيص معاش تقاعدي',
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/download',
  },
  'ت8': {
    code: 'ت8',
    title: 'إقرار من مستفيد',
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0007/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0007/download',
  },
  'ت9': {
    code: 'ت9',
    title: 'شهادة أيتام وأرامل',
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0008/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0008/download',
  },
};

const sharedDaleelRequirements = [
  'شهادة وفاة صاحب المعاش عند الاقتضاء',
  'بيان عائلي أو إخراج قيد حديث',
  'بطاقة هوية المستفيد',
  'إثبات عنوان أو سكن',
];

const sharedDaleelSteps = [
  'اختيار صفة المستفيد من الدليل',
  'تحضير المستندات المطلوبة',
  'فتح النماذج الرسمية عند الحاجة',
  'تقديم الملف لدى المرجع المختص',
];

const lafSourceUrl = 'https://www.lebarmy.gov.lb/ar/administrative_transactions/2344';

const daleelProcedures: ProcedureItem[] = [
  {
    id: 'daleel-mof-spouse',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '👩‍🦳',
    title: 'زوجة المتقاعد المتوفي',
    subtitle: 'معاملة إعادة تخصيص معاش تقاعدي للزوجة الشرعية.',
    badges: ['تقاعد', 'ت7 / ت8'],
    requirements: ['عقد زواج', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['زوجة', 'أرملة', 'معاش', 'تقاعد', 'ت7', 'ت8'],
  },
  {
    id: 'daleel-mof-single-daughter',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '👧',
    title: 'الابنة العزباء',
    subtitle: 'استفادة ابنة المتقاعد غير المتزوجة وفق شروط الدليل.',
    badges: ['ابنة', 'ت7 / ت8 / ت9'],
    requirements: ['إفادة عزوبية أو قيد يثبت الوضع العائلي', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8'], forms['ت9']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['ابنة', 'عزباء', 'معاش', 'تقاعد', 'ت9'],
  },
  {
    id: 'daleel-mof-widow-daughter',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '👩',
    title: 'الابنة الأرملة أو المطلقة',
    subtitle: 'إعادة تخصيص معاش لابنة أرملة أو مطلقة.',
    badges: ['ابنة', 'ت7 / ت8 / ت9'],
    requirements: ['حكم طلاق أو شهادة وفاة الزوج', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8'], forms['ت9']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['ابنة', 'أرملة', 'مطلقة', 'معاش', 'تقاعد'],
  },
  {
    id: 'daleel-mof-minor-son',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '👦',
    title: 'الابن القاصر',
    subtitle: 'استفادة الابن القاصر ضمن ملف عائلة المتقاعد.',
    badges: ['قاصر', 'ت7 / ت8'],
    requirements: ['إخراج قيد يثبت العمر والوصاية عند الحاجة', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['ابن', 'قاصر', 'معاش', 'تقاعد'],
  },
  {
    id: 'daleel-mof-student-son',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '🎓',
    title: 'الابن الذي يتابع الدراسة',
    subtitle: 'استفادة مرتبطة بمتابعة الدراسة وإثباتها.',
    badges: ['إفادة مدرسية', 'ت7 / ت8'],
    requirements: ['إفادة متابعة دراسة حديثة', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['ابن', 'طالب', 'دراسة', 'مدرسة', 'جامعة', 'معاش'],
  },
  {
    id: 'daleel-mof-disabled-son',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '♿',
    title: 'الابن المعوق جسدياً أو عقلياً',
    subtitle: 'استفادة مبنية على تقرير أو إثبات طبي رسمي.',
    badges: ['تقرير طبي', 'ت7 / ت8'],
    requirements: ['تقرير طبي أو مستند رسمي يثبت الحالة', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['ابن', 'معوق', 'إعاقة', 'تقرير طبي', 'معاش'],
  },
  {
    id: 'daleel-mof-parent',
    source: 'mof',
    sourceTitle: 'المعاملات / دائرة التقاعد',
    icon: '👵',
    title: 'الوالد أو الوالدة',
    subtitle: 'استفادة الوالد أو الوالدة حسب شروط الدليل.',
    badges: ['أصول', 'ت7 / ت8'],
    requirements: ['إثبات صلة القرابة', ...sharedDaleelRequirements],
    steps: sharedDaleelSteps,
    forms: [forms['ت7'], forms['ت8']],
    primaryLabel: 'فتح النماذج',
    endpointLabel: 'دليل المعاملات / دائرة التقاعد',
    defaultVisible: true,
    keywords: ['والد', 'والدة', 'أب', 'أم', 'معاش', 'تقاعد'],
  },
  {
    id: 'daleel-laf-service-certificate',
    source: 'laf',
    sourceTitle: 'المعاملات / الجيش',
    icon: '🪖',
    title: 'إفادة خدمة للمتقاعد العسكري',
    subtitle: 'معاملة مرتبطة بإثبات الخدمة العسكرية للمتقاعد.',
    badges: ['جيش', 'إفادة خدمة'],
    requirements: ['هوية صاحب العلاقة', 'مستند يثبت الصفة أو التقاعد', 'طلب أو مراجعة الجهة المختصة'],
    steps: ['تحديد نوع الإفادة', 'تحضير المستندات', 'مراجعة المرجع العسكري المختص'],
    primaryLabel: 'تفاصيل',
    endpointLabel: 'دليل المعاملات / الجيش',
    defaultVisible: true,
    keywords: ['متقاعد', 'إفادة', 'خدمة', 'جيش', 'عسكري', 'veteran'],
  },
  {
    id: 'daleel-laf-retiree-family-file',
    source: 'laf',
    sourceTitle: 'المعاملات / الجيش',
    icon: '👨‍👩‍👧‍👦',
    title: 'تحديث ملف عائلة المتقاعد العسكري',
    subtitle: 'معاملة عائلية مرتبطة بالمتقاعد وذوي الحقوق.',
    badges: ['عائلة', 'ذوو الحقوق'],
    requirements: ['بيان عائلي حديث', 'هوية أو إخراج قيد', 'مستند يثبت صفة المستفيد'],
    steps: ['جمع مستندات العائلة', 'تحديد صفة المستفيد', 'تقديم الملف لدى المرجع المختص'],
    primaryLabel: 'تفاصيل',
    endpointLabel: 'دليل المعاملات / الجيش',
    defaultVisible: true,
    keywords: ['عائلة', 'ذوي الحقوق', 'متقاعد', 'عسكري', 'زوجة', 'أولاد'],
  },
  {
    id: 'daleel-laf-medical-retiree',
    source: 'laf',
    sourceTitle: 'المعاملات / الجيش',
    icon: '🏥',
    title: 'مراجعة طبابة أو ملف صحي للمتقاعد',
    subtitle: 'إرشاد مختصر للمعاملات الصحية المرتبطة بالمتقاعد وعائلته.',
    badges: ['طبابة', 'صحة'],
    requirements: ['هوية المستفيد', 'مستند يثبت الصفة', 'تقرير أو إحالة عند الحاجة'],
    steps: ['تحديد نوع المراجعة الصحية', 'تحضير الإثباتات', 'مراجعة الجهة الصحية المختصة'],
    primaryLabel: 'تفاصيل',
    endpointLabel: 'دليل المعاملات / الجيش',
    defaultVisible: true,
    keywords: ['طبابة', 'صحة', 'استشفاء', 'متقاعد', 'عسكري'],
  },
];

const lafSearchOnlyProcedures: ProcedureItem[] = [
  {
    id: 'laf-temporary-vsat-stations',
    source: 'laf',
    sourceTitle: 'قيادة الجيش',
    icon: '📡',
    title: 'إدخال محطات إرسال أرضية وفضائية مؤقتة',
    subtitle: 'إجراء إداري عام لا يظهر افتراضياً لأنه غير خاص بالمتقاعدين.',
    badges: ['قيادة الجيش', 'مديرية الإشارة', 'بحث فقط'],
    requirements: ['كتاب طلب رسمي', 'معلومات تقنية عن المحطة', 'مدة ومكان الاستخدام'],
    steps: ['ابحث عنها بالاسم أو بكلمة VSAT', 'افتح المصدر الرسمي', 'راجع الشروط'],
    primaryLabel: 'فتح المصدر',
    href: lafSourceUrl,
    endpointLabel: 'موقع قيادة الجيش',
    defaultVisible: false,
    searchOnlyReason: 'إجراء عام يظهر فقط عند البحث.',
    keywords: ['vsat', 'إرسال', 'فضائية', 'محطة', 'مؤقتة'],
  },
  {
    id: 'laf-civilian-entry-military-centers',
    source: 'laf',
    sourceTitle: 'قيادة الجيش',
    icon: '🪪',
    title: 'السماح بدخول مدنيين إلى مراكز عسكرية',
    subtitle: 'إجراء إداري عام يظهر فقط عند البحث المباشر.',
    badges: ['قيادة الجيش', 'دخول مدنيين', 'بحث فقط'],
    requirements: ['كتاب طلب رسمي', 'أسماء الداخلين', 'سبب الدخول وتاريخه'],
    steps: ['ابحث عنها بكلمة دخول أو مدنيين', 'افتح المصدر الرسمي', 'اتبع الشروط'],
    primaryLabel: 'فتح المصدر',
    href: lafSourceUrl,
    endpointLabel: 'موقع قيادة الجيش',
    defaultVisible: false,
    searchOnlyReason: 'إجراء عام يظهر فقط عند البحث.',
    keywords: ['دخول', 'مدنيين', 'مراكز عسكرية', 'ثكنة'],
  },
  {
    id: 'laf-install-towers-near-military-centers',
    source: 'laf',
    sourceTitle: 'قيادة الجيش',
    icon: '🗼',
    title: 'تركيب أبراج أو محطات قرب مراكز عسكرية',
    subtitle: 'إجراء تقني عام يظهر عند البحث فقط.',
    badges: ['قيادة الجيش', 'أبراج ومحطات', 'بحث فقط'],
    requirements: ['موقع التركيب', 'مواصفات العتاد', 'خرائط أو إحداثيات عند الحاجة'],
    steps: ['ابحث عنها بكلمة أبراج أو محطات', 'افتح المصدر الرسمي', 'راجع المتطلبات'],
    primaryLabel: 'فتح المصدر',
    href: lafSourceUrl,
    endpointLabel: 'موقع قيادة الجيش',
    defaultVisible: false,
    searchOnlyReason: 'إجراء عام يظهر فقط عند البحث.',
    keywords: ['أبراج', 'محطات', 'تركيب', 'قرب مراكز عسكرية'],
  },
  {
    id: 'laf-install-signal-boosters-inside-military-centers',
    source: 'laf',
    sourceTitle: 'قيادة الجيش',
    icon: '📶',
    title: 'تركيب تقوية إرسال داخل مراكز عسكرية',
    subtitle: 'إجراء تقني عام لا يظهر ضمن المعاملات الافتراضية.',
    badges: ['قيادة الجيش', 'تقوية إرسال', 'بحث فقط'],
    requirements: ['كتاب طلب رسمي', 'مواصفات التجهيزات', 'مكان التركيب'],
    steps: ['ابحث عنها بكلمة تقوية إرسال', 'افتح المصدر الرسمي', 'راجع المتطلبات'],
    primaryLabel: 'فتح المصدر',
    href: lafSourceUrl,
    endpointLabel: 'موقع قيادة الجيش',
    defaultVisible: false,
    searchOnlyReason: 'إجراء عام يظهر فقط عند البحث.',
    keywords: ['تقوية', 'إرسال', 'مراكز عسكرية', 'signal'],
  },
];

const procedures: ProcedureItem[] = [...daleelProcedures, ...lafSearchOnlyProcedures];

const proceduresScrollStyle: CSSProperties = {
  overflow: 'visible',
  paddingBottom: 'var(--apex-content-bottom-clearance)',
  scrollPaddingBottom: 'var(--apex-content-bottom-clearance)',
};

function openExternalTarget(url?: string) {
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  globalThis.location.assign(url);
}

function searchableText(item: ProcedureItem) {
  return [
    item.title,
    item.subtitle,
    item.sourceTitle,
    item.searchOnlyReason,
    ...item.badges,
    ...item.requirements,
    ...item.steps,
    ...(item.keywords || []),
    ...(item.forms || []).flatMap((form) => [form.code, form.title]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function WatanyCompactProceduresViewer() {
  const [source, setSource] = useState<ProcedureSource>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const hasSearch = query.trim().length > 0;

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return procedures.filter((item) => {
      const sourceMatch = source === 'all' || item.source === source;

      if (!sourceMatch) {
        return false;
      }

      if (!q) {
        return item.defaultVisible;
      }

      return searchableText(item).includes(q);
    });
  }, [query, source]);

  function changeSource(nextSource: ProcedureSource) {
    setSource(nextSource);
    setExpandedId(null);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setExpandedId(null);
  }

  function showToast(message: string) {
    setToast(message);
    globalThis.setTimeout(() => setToast(''), 1700);
  }

  async function openUniversalForm(_procedure: ProcedureItem, form: ProcedureForm) {
    try {
      // Use the explicit download URL for procedures to avoid hitting
      // preview endpoints that may return HTML error pages under /preview.
      await openWatanyUniversalFormViewer({
        titleAr: form.title,
        previewUrl: form.downloadUrl ?? form.previewUrl ?? '',
        downloadUrl: form.downloadUrl ?? form.previewUrl,
        preferUniversal: true,
      });
      showToast(`تم فتح ${form.code} في العارض الموحد`);
    } catch (error) {
      console.error('Failed to open procedure form in universal viewer', error);
      showToast('تعذّر فتح العارض الموحد لهذا النموذج');
    }
  }

  function openPrimaryAction(item: ProcedureItem) {
    const firstForm = item.forms?.[0];

    if (firstForm) {
      openUniversalForm(item, firstForm);
      return;
    }

    openExternalTarget(item.href);
  }

  function askWatany(item: ProcedureItem) {
    const detail = {
      type: 'procedure',
      id: item.id,
      title: item.title,
      source: item.sourceTitle,
      requirements: item.requirements,
      forms: item.forms || [],
    };

    globalThis.dispatchEvent(new CustomEvent('watany:chat-context', { detail }));
    globalThis.dispatchEvent(new CustomEvent('watany:open-chat', { detail }));
    showToast('تم تجهيز السؤال في دردشة موطني');
  }

  async function copyLink(item: ProcedureItem) {
    const link = `${globalThis.location.origin}${globalThis.location.pathname}#procedure-${item.id}`;
    try {
      await globalThis.navigator.clipboard.writeText(link);
      showToast('تم نسخ رابط المعاملة');
    } catch {
      showToast(link);
    }
  }

  return (
    <main className="watany-procedure-compact" dir="rtl" aria-label="المعاملات" data-watany-procedure-total={procedures.filter((item) => item.defaultVisible).length}>
      <section className="watany-procedure-compact__list procedures-browser__items" aria-label="لائحة المعاملات" style={proceduresScrollStyle}>
        {visibleItems.length === 0 ? (
          <div className="watany-procedure-compact__empty">لا توجد معاملات مطابقة. ابحث بكلمة أبسط أو اختر الكل.</div>
        ) : (
          visibleItems.map((item) => {
            const expanded = expandedId === item.id;

            return (
              <article
                className={`watany-procedure-card watany-listing-card procedures-browser__item ${expanded ? 'is-expanded procedures-browser__item--expanded' : ''}`}
                id={`procedure-${item.id}`}
                data-watany-procedure-card="true"
                key={item.id}
              >
                <div className="watany-procedure-card__summary watany-listing-card__top">
                  <div className="watany-procedure-card__body watany-listing-card__body">
                    <div className="watany-procedure-card__badges watany-listing-card__meta">
                      {item.badges.slice(0, 3).map((badge) => <span className="watany-listing-card__badge" key={badge}>{badge}</span>)}
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.subtitle}</p>
                  </div>
                </div>

                <div className="watany-procedure-card__actions watany-listing-card__actions">
                  <button type="button" className="watany-procedure-card__primary watany-listing-card__button watany-listing-card__button--primary" onClick={() => openPrimaryAction(item)}>
                    {item.primaryLabel}
                  </button>
                  <button
                    type="button"
                    className="watany-procedure-card__secondary watany-listing-card__button watany-listing-card__button--secondary"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    aria-expanded={expanded}
                    aria-controls={`procedure-details-${item.id}`}
                  >
                    {expanded ? 'إخفاء' : 'تفاصيل'}
                  </button>
                </div>

                {expanded ? (
                  <div className="watany-procedure-card__details" id={`procedure-details-${item.id}`}>
                    {item.searchOnlyReason ? (
                      <section>
                        <h3>ملاحظة</h3>
                        <p>{item.searchOnlyReason}</p>
                      </section>
                    ) : null}

                    <section>
                      <h3>المطلوب</h3>
                      <ul>{item.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                    </section>

                    <section>
                      <h3>الخطوات</h3>
                      <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    </section>

                    {item.forms?.length ? (
                      <section>
                        <h3>النماذج</h3>
                        <div className="watany-procedure-card__forms">
                          {item.forms.map((form) => (
                            <div className="watany-procedure-form-chip" key={`${item.id}-${form.code}`}>
                              <strong>{form.code}</strong>
                              <span>{form.title}</span>
                              <div>
                                <button type="button" onClick={() => openUniversalForm(item, form)}>فتح في عارض النماذج</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    <section>
                      <h3>المصدر</h3>
                      <p>{item.endpointLabel}</p>
                    </section>

                    <div className="watany-procedure-card__detail-actions">
                      <button type="button" onClick={() => askWatany(item)}>اسأل موطني</button>
                      <button type="button" onClick={() => copyLink(item)}>نسخ الرابط</button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      {toast ? <output className="watany-procedure-compact__toast">{toast}</output> : null}
    </main>
  );
}




