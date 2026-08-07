/**
 * MofMobileProceduresViewer.tsx
 * Mobile-first MOF procedures viewer — دائرة التقاعد- المالية
 * Renders v9 data: single-column cards, family chips, search.
 * All CTAs are routed through the universal form viewer for consistent controls.
 */
import { useState, useCallback, useRef, type FC, type ReactNode } from 'react';
import { MOF_V9_DATA, type MofV9Card, type MofV9CtaButton } from '../../data/watanyMofMobileViewerV9';
import { openWatanyUniversalFormViewer } from '../../lib/watanyUniversalFormViewer';
// APEX_CSS_FREEZE_DISABLED_IMPORT import '../../styles/watany-mof-mobile-procedures.css';

type MofMobileProceduresViewerProps = {
  hideSearch?: boolean;
};

const MOF_FORM_PDF_MAP: Record<string, { previewUrl: string; downloadUrl: string }> = {
  'mof-form-t7': {
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/download',
  },
  'mof-form-t8': {
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0007/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0007/download',
  },
  'mof-form-t9': {
    previewUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0008/preview',
    downloadUrl: '/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0008/download',
  },
};

const MOF_TITLE_DOC_CODE_MAP: Record<string, string> = {
  'اقرار من متقاعد': '0001',
  'طلب توطين': '0002',
  'طلب تخصيص معاش تقاعدي او تعويض صرف': '0003',
  'مستندات اعادة التخصيص الاساسية': '0004',
  'المستندات الاضافية للزوجة': '0005',
  'طلب اعادة تخصيص معاش تقاعدي ت7': '0006',
  'اقرار من مستفيد ت8': '0007',
  'شهادة ايتام وارامل ت9': '0008',
  'المستندات الاضافية للزوج': '0009',
  'المستندات الاضافية للابنة العزباء': '0010',
  'المستندات الاضافية للابنة العزباء القاصر': '0011',
  'المستندات الاضافية للابنة الارملة': '0012',
  'دليل تصديق الافادات المدرسية والجامعية': '0013',
  'اقرار وتعهد من الابنة الارملة او المطلقة ت11': '0014',
  'المستندات الاضافية للابنة المطلقة': '0015',
  'المستندات الاضافية للابن الذي يتابع الدراسة': '0016',
  'المستندات الاضافية للابن القاصر': '0017',
  'المستندات الاضافية للابن المعوق جسديا': '0018',
  'المستندات الاضافية للابن المعوق نفسيا او عقليا': '0019',
  'المستندات الاضافية للوالدة': '0020',
  'المستندات الاضافية للوالد': '0021',
  'طلب ايقاف معاش تقاعدي': '0022',
  'طلب ايقاف معاش تقاعدي ت6': '0023',
  'حالات تعديل الوضع العايلي': '0024',
  'حالات تعديل الوضع العائلي': '0024',
  'طلب تعديل وضع عايلي ت2': '0025',
  'طلب تعديل وضع عائلي ت2': '0025',
  'اقرار من متقاعد ت12': '0026',
  'طلب صرف تعويض عايلي او معاش تقاعدي لابن المتقاعد الذي يتابع الدراسة': '0027',
  'طلب صرف تعويض عايلي او معاش تقاعدي لابن المتقاعد الذي يتابع الدراسة ت3': '0028',
  'طلب صرف تعويض عايلي او معاش تقاعدي لابنة المتقاعد الارملة او المطلقة في حال مثابرة ابنها للدراسة': '0029',
  'طلب صرف تعويض عايلي او معاش تقاعدي لابنة المتقاعد الارملة او المطلقة في حال مثابرة ابنها للدراسة ت4': '0030',
  'طلب معاينة من اللجنة الطبية الدائمة في وزارة الصحة العامة': '0031',
  'طلب معاينة من اللجنة الطبية الدائمة في وزارة الصحة العامة ت5': '0032',
  'طلب تعديل رقم حساب مصرفي': '0033',
  'طلب تعديل رقم حساب مصرفي ت10': '0034',
  'طلب دفتر تقاعد بدل عن ضائع': '0035',
  'طلب دفتر تقاعد بدل عن ضائع ت1': '0035',
};

const UNMAPPED_CTA_DEBUG_SEEN = new Set<string>();

function debugUnmappedCta(btn: MofV9CtaButton, reason: 'title-not-in-doc-map' | 'placeholder-route' | 'missing-viewer-url'): void {
  if (!import.meta.env.DEV) return;
  const key = `${reason}::${btn.id}::${normalizeLookup(btn.title)}`;
  if (UNMAPPED_CTA_DEBUG_SEEN.has(key)) return;
  UNMAPPED_CTA_DEBUG_SEEN.add(key);
  console.warn('[MOF][unmapped-cta]', {
    reason,
    id: btn.id,
    title: btn.title,
    preview_endpoint: btn.preview_endpoint,
    viewer_route: btn.viewer_route,
  });
}

function normalizeLookup(value: string): string {
  return normAr(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[-ـ]/g, ' ')
    .replace(/[،,:؛/()"'“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDocUrls(code: string): { previewUrl: string; downloadUrl: string } {
  const id = `DOC-WATANY_MOF_HTML-${code}`;
  return {
    previewUrl: `/api/v2/procedures/docs/${id}/preview`,
    downloadUrl: `/api/v2/procedures/docs/${id}/download`,
  };
}

function normAr(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[إأآٱ]/g, 'ا')
    .split('ة').join('ه')
    .split('ى').join('ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function cardMatchesQuery(card: MofV9Card, q: string): boolean {
  if (!q) return true;
  const hay = normAr([
    card.title,
    card.when_applies,
    card.family_label,
    ...(card.person_tags ?? []),
    ...(card.document_ctas ?? []).map((x) => x.title),
    ...(card.form_ctas ?? []).map((x) => x.title),
  ].join(' '));
  return q.split(' ').filter(Boolean).every((token) => hay.includes(token));
}

function resolveViewerUrls(btn: MofV9CtaButton): { previewUrl: string; downloadUrl: string; badge: string } {
  const known = MOF_FORM_PDF_MAP[btn.id];
  if (known) {
    return {
      previewUrl: known.previewUrl,
      downloadUrl: known.downloadUrl,
      badge: 'PDF',
    };
  }

  const mappedDocCode = MOF_TITLE_DOC_CODE_MAP[normalizeLookup(btn.title)];
  if (mappedDocCode) {
    const urls = buildDocUrls(mappedDocCode);
    return {
      previewUrl: urls.previewUrl,
      downloadUrl: urls.downloadUrl,
      badge: 'PDF',
    };
  }

  debugUnmappedCta(btn, 'title-not-in-doc-map');

  // Generated v9 placeholder routes are not backed by gateway endpoints.
  if ((btn.preview_endpoint || '').includes('/api/forms/preview/')) {
    debugUnmappedCta(btn, 'placeholder-route');
    return {
      previewUrl: '',
      downloadUrl: '',
      badge: 'غير متوفر',
    };
  }

  const previewUrl = btn.preview_endpoint || btn.viewer_route || '';
  const downloadUrl = previewUrl.includes('/preview/')
    ? previewUrl.replace('/preview/', '/download/')
    : previewUrl;

  return {
    previewUrl,
    downloadUrl,
    badge: previewUrl ? 'عرض' : 'قيد الربط',
  };
}

function isCtaBacked(btn: MofV9CtaButton): boolean {
  const resolved = resolveViewerUrls(btn);
  if (!resolved.previewUrl && !resolved.downloadUrl) {
    debugUnmappedCta(btn, 'missing-viewer-url');
  }
  return Boolean(resolved.previewUrl || resolved.downloadUrl);
}

const CtaButton: FC<{ btn: MofV9CtaButton }> = ({ btn }) => {
  const resolved = resolveViewerUrls(btn);
  const disabled = !resolved.previewUrl && !resolved.downloadUrl;

  return (
    <button
      type="button"
      className="mof-viewer__cta"
      data-testid={`mof-procedure-cta-${btn.id}`}
      data-procedure-cta-id={btn.id}
      onClick={() => {
        if (disabled) return;
        void openWatanyUniversalFormViewer({
          titleAr: btn.title,
          previewUrl: resolved.previewUrl,
          downloadUrl: resolved.downloadUrl,
          preferUniversal: true,
        });
      }}
      disabled={disabled}
    >
      <span>{btn.title}</span>
      <small>{resolved.badge}</small>
    </button>
  );
};

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="mof-viewer__section">
    <p className="mof-viewer__section-title">{title}</p>
    {children}
  </div>
);

const ProcedureCard: FC<{
  card: MofV9Card;
  isOpen: boolean;
  onToggle: () => void;
  onJumpTo: (id: string) => void;
}> = ({ card, isOpen, onToggle, onJumpTo }) => {
  const backedDocumentCtas = (card.document_ctas ?? []).filter(isCtaBacked);
  const backedFormCtas = (card.form_ctas ?? []).filter(isCtaBacked);

  return (
    <div className="mof-viewer__entry" id={card.id}>
      <button
        type="button"
        className="mof-viewer__entry-head"
        data-testid={`mof-procedure-toggle-${card.id}`}
        data-procedure-card-id={card.id}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'إخفاء تفاصيل المعاملة' : 'إظهار تفاصيل المعاملة'}
      >
        <div>
          <h2 className="mof-viewer__entry-title">{card.title}</h2>
          {card.when_applies && <p className="mof-viewer__entry-when">{card.when_applies}</p>}
          <div className="mof-viewer__entry-tags">
            <span className="mof-viewer__tag">{card.family_label}</span>
            {(card.person_tags ?? []).map((tag) => (
              <span key={tag} className="mof-viewer__tag">{tag}</span>
            ))}
          </div>
        </div>
        <span className="mof-viewer__expand-btn" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="mof-viewer__entry-body">
          {(card.flow_steps ?? []).length > 0 && (
            <Section title="مسار مختصر">
              <ol className="mof-viewer__flow">
                {card.flow_steps.map((step) => <li key={`${card.id}-step-${step}`}>{step}</li>)}
              </ol>
            </Section>
          )}

          <Section title="المستندات">
            {backedDocumentCtas.some(Boolean)
              ? <div className="mof-viewer__cta-list">
                  {backedDocumentCtas.map((doc) => (
                    <CtaButton key={doc.id} btn={doc} />
                  ))}
                </div>
              : <p className="mof-viewer__empty">لا يوجد مستندات.</p>
            }
          </Section>

          <Section title="نماذج الإجراء">
            {backedFormCtas.some(Boolean)
              ? <div className="mof-viewer__cta-list">
                  {backedFormCtas.map((form) => (
                    <CtaButton key={form.id} btn={form} />
                  ))}
                </div>
              : <p className="mof-viewer__empty">لا يوجد نماذج.</p>
            }
          </Section>

          <Section title="معاملات متصلة">
            {(card.related_cards ?? []).length > 0
              ? <div className="mof-viewer__related">
                  {card.related_cards.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      className="mof-viewer__rel-btn"
                      onClick={() => onJumpTo(rel.id)}
                    >
                      {rel.title}
                    </button>
                  ))}
                </div>
              : <p className="mof-viewer__empty">لا يوجد معاملات متصلة.</p>
            }
          </Section>

          {(card.details_blocks ?? []).length > 0 && (
            <Section title="تفاصيل إضافية">
              {card.details_blocks.map((block) => (
                <div key={`${card.id}-detail-${block}`} className="mof-viewer__details-block">{block}</div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
};

const MofMobileProceduresViewer: FC<MofMobileProceduresViewerProps> = ({ hideSearch = false }) => {
  const data = MOF_V9_DATA;
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = normAr(query);

  const visibleCards = data.cards.filter((card) => {
    const queryOk = cardMatchesQuery(card, normalizedQuery);
    return queryOk;
  });

  const toggleCard = useCallback((id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const jumpTo = useCallback((id: string) => {
    setQuery('');
    setOpenIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="mof-viewer" dir="rtl" ref={containerRef}>
      {hideSearch ? null : (
        <header className="mof-viewer__header">
          <div className="mof-viewer__search">
            <input
              type="search"
              className="mof-viewer__search-input"
              placeholder="بحث في المعاملات..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="بحث في معاملات دائرة التقاعد"
            />
          </div>
        </header>
      )}

      <main className="mof-viewer__entries">
        {visibleCards.length === 0
          ? <div className="mof-viewer__empty">لا توجد نتائج.</div>
          : visibleCards.map((card) => (
              <ProcedureCard
                key={card.id}
                card={card}
                isOpen={Boolean(openIds[card.id])}
                onToggle={() => toggleCard(card.id)}
                onJumpTo={jumpTo}
              />
            ))
        }
      </main>

      <nav className="mof-viewer__bottom">
        <span className="mof-viewer__bottom-stat">
          {visibleCards.length} ظاهرة · {data.counts.cards} إجمالي
        </span>
        <button type="button" className="mof-viewer__scroll-top" onClick={scrollToTop}>
          أعلى الصفحة
        </button>
      </nav>
    </div>
  );
};

export default MofMobileProceduresViewer;
