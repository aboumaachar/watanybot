/* APEX WatanyBot V1 Homepage All-Level Icons Runtime v1.8 */
const WATANY_HOMEPAGE_LABELS = [
  'المعاش','إجراءات','مدارس','تاكسي','السوق','وظائف','الشبكة','أدوات','التعاميم','وفيات','مجتمعي','صوّت','صوت','نماذج','قوانين','أسئلة','كأس العالم','زائف','أخبار'
];

function normText(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isHTMLElement(value: Element | null | undefined): value is HTMLElement {
  return !!value && value instanceof HTMLElement;
}

function visibleRect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

function findLabelElements(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll('a,button,div,span,p,strong,b,h1,h2,h3,h4,h5,h6'));
  const labels: HTMLElement[] = [];
  for (const el of all) {
    if (!isHTMLElement(el)) continue;
    const text = normText(el.textContent);
    if (!text) continue;
    for (const label of WATANY_HOMEPAGE_LABELS) {
      if (text === label || text.endsWith(' ' + label) || text.includes(label)) {
        const rect = visibleRect(el);
        if (rect.width > 0 && rect.height > 0) {
          labels.push(el);
          break;
        }
      }
    }
  }
  return labels;
}

function findCard(labelEl: HTMLElement): HTMLElement {
  let current: HTMLElement | null = labelEl;
  for (let i = 0; i < 7 && current; i++) {
    const tag = current.tagName.toLowerCase();
    const cls = String(current.className || '');
    const rect = visibleRect(current);
    const hasGraphic = !!current.querySelector('img,svg,[role="img"]');
    if ((tag === 'a' || tag === 'button' || cls.includes('card') || cls.includes('feature') || cls.includes('icon')) && rect.width >= 70 && rect.height >= 70) {
      return current;
    }
    if (hasGraphic && rect.width >= 90 && rect.width <= 260 && rect.height >= 90 && rect.height <= 260) {
      return current;
    }
    current = current.parentElement;
  }
  return labelEl.parentElement || labelEl;
}

function findTile(card: HTMLElement, labelEl: HTMLElement): HTMLElement {
  const graphic = card.querySelector('img,svg,[role="img"]');
  if (graphic && graphic.parentElement) {
    let tile: HTMLElement | null = graphic.parentElement;
    for (let i = 0; i < 4 && tile && tile !== card; i++) {
      const rect = visibleRect(tile);
      if (rect.width >= 55 && rect.height >= 55 && rect.width <= 220 && rect.height <= 220) return tile;
      tile = tile.parentElement;
    }
    if (isHTMLElement(graphic.parentElement)) return graphic.parentElement;
  }

  const children = Array.from(card.children).filter((child) => child !== labelEl) as HTMLElement[];
  let best: HTMLElement | null = null;
  for (const child of children) {
    if (!isHTMLElement(child)) continue;
    const rect = visibleRect(child);
    const text = normText(child.textContent);
    if (rect.width >= 45 && rect.height >= 45 && text !== normText(labelEl.textContent)) {
      best = child;
      break;
    }
  }
  return best || card;
}

function findGlyph(tile: HTMLElement): HTMLElement | null {
  const graphic = tile.querySelector('img,svg,[role="img"]');
  if (isHTMLElement(graphic)) return graphic;
  const children = Array.from(tile.children) as HTMLElement[];
  for (const child of children) {
    if (!isHTMLElement(child)) continue;
    const text = normText(child.textContent);
    const rect = visibleRect(child);
    if (rect.width > 0 && rect.height > 0 && text.length <= 4) return child;
  }
  return null;
}

function findGrid(card: HTMLElement): HTMLElement | null {
  let current = card.parentElement;
  for (let i = 0; i < 5 && current; i++) {
    const children = Array.from(current.children).filter((x) => x instanceof HTMLElement) as HTMLElement[];
    let cardLike = 0;
    for (const child of children) {
      if (child.classList.contains('watany-homepage-unified-card')) cardLike++;
    }
    if (cardLike >= 3) return current;
    current = current.parentElement;
  }
  return card.parentElement;
}

function normalizeHomepageIcons(): void {
  const labelElements = findLabelElements();
  const cards = new Set<HTMLElement>();
  for (const labelEl of labelElements) {
    const labelText = normText(labelEl.textContent);
    const matched = WATANY_HOMEPAGE_LABELS.some((label) => labelText.includes(label));
    if (!matched) continue;
    const card = findCard(labelEl);
    const tile = findTile(card, labelEl);
    const glyph = findGlyph(tile);
    const grid = findGrid(card);
    if (grid) grid.classList.add('watany-homepage-unified-grid');
    card.classList.add('watany-homepage-unified-card');
    tile.classList.add('watany-homepage-unified-tile');
    labelEl.classList.add('watany-homepage-unified-label');
    if (glyph) glyph.classList.add('watany-homepage-unified-glyph');
    cards.add(card);
  }
  document.documentElement.setAttribute('data-watany-homepage-unified-icons-count', String(cards.size));
}

normalizeHomepageIcons();
window.setTimeout(normalizeHomepageIcons, 150);
window.setTimeout(normalizeHomepageIcons, 600);
window.setTimeout(normalizeHomepageIcons, 1400);

const observer = new MutationObserver(() => normalizeHomepageIcons());
observer.observe(document.documentElement, { childList: true, subtree: true });
