const WATANY_APPROVED_FEATURE_LABELS = [
  'وظائف',
  'السوق',
  'تاكسي',
  'التعاميم',
  'أدوات',
  'الشبكة',
  'صوّت',
  'صوت',
  'مجتمعي',
  'وفيات',
  'المعاش',
  'إجراءات',
  'مدارس',
  'قوانين',
  'أسئلة',
  'أخبار',
  'زائف',
  'نماذج',
  'كأس العالم'
];

function watanyTextOf(el: Element | null): string {
  return ((el as HTMLElement | null)?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function watanyHasApprovedLabel(text: string): boolean {
  return WATANY_APPROVED_FEATURE_LABELS.some((label) => text.includes(label));
}

function watanyFindLabel(card: HTMLElement): HTMLElement | null {
  const nodes = Array.from(card.querySelectorAll<HTMLElement>('span,div,p,strong,b,small'));
  let best: HTMLElement | null = null;
  for (const node of nodes) {
    const text = watanyTextOf(node);
    if (!text || !watanyHasApprovedLabel(text)) continue;
    if (!best || text.length < watanyTextOf(best).length) best = node;
  }
  return best;
}

function watanyIsIconish(el: HTMLElement | null, labelEl: HTMLElement | null): boolean {
  if (!el || el === labelEl) return false;
  const className = String(el.className || '');
  if (/icon|emoji|glyph|avatar|symbol|tile/i.test(className)) return true;
  if (el.querySelector('svg,img')) return true;
  const text = watanyTextOf(el);
  if (text && text.length <= 4 && !watanyHasApprovedLabel(text)) return true;
  return false;
}

function watanyFindTile(card: HTMLElement, labelEl: HTMLElement | null): HTMLElement | null {
  const preferred = card.querySelector<HTMLElement>('.home-icon-tile,.feature-icon-tile,.watany-feature-icon-tile,.feature-icon,.watany-feature-icon,.utility-action-icon,.quick-action-icon,.pillar-icon,.unified-pillar-icon,.action-icon,.menu-icon,.service-icon,.card-icon,[data-icon]');
  if (preferred && preferred !== labelEl) return preferred;

  const children = Array.from(card.children) as HTMLElement[];
  for (const child of children) {
    if (watanyIsIconish(child, labelEl)) return child;
  }

  if (labelEl?.previousElementSibling instanceof HTMLElement) {
    return labelEl.previousElementSibling;
  }

  return null;
}

function watanyNormalizeCard(card: HTMLElement): void {
  const text = watanyTextOf(card);
  if (!watanyHasApprovedLabel(text)) return;

  card.classList.add('watany-approved-runtime-card');
  const labelEl = watanyFindLabel(card);
  if (labelEl && labelEl !== card) labelEl.classList.add('watany-approved-runtime-label');

  const tile = watanyFindTile(card, labelEl);
  if (tile && tile !== labelEl) {
    tile.classList.add('watany-approved-runtime-tile');
    const glyph = tile.querySelector<HTMLElement>('svg,img');
    if (glyph) glyph.classList.add('watany-approved-runtime-glyph');
  }
}

function watanyNormalizeApprovedHomeIcons(): void {
  if (typeof document === 'undefined') return;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.watany-approved-home-icons a, .watany-approved-home-icons button, .watany-approved-home-icons [role="button"], .watany-approved-home-icons .feature-card, .watany-approved-home-icons .home-icon-card, .watany-approved-home-icons .watany-feature-card, .watany-approved-home-icons .utility-action-card, .watany-approved-home-icons .quick-action, .watany-approved-home-icons .quick-action-card, .watany-approved-home-icons .pillar-card, .watany-approved-home-icons .unified-pillar-card'
    )
  );
  for (const card of candidates) watanyNormalizeCard(card);
}

if (typeof window !== 'undefined') {
  const run = () => watanyNormalizeApprovedHomeIcons();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    window.setTimeout(run, 0);
  }

  const observer = new MutationObserver(() => run());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export {};