const HOME_ORDER = [
  { key: "now", labels: ["يجري الان", "يجري الآن", "الآن", "الان"] },
  { key: "services", labels: ["خدمات", "الخدمات"] },
  { key: "tools", labels: ["ادوات", "أدوات", "الأدوات"] },
  { key: "jobs", labels: ["الوظائف", "وظائف", "فرص العمل"] },
  { key: "market", labels: ["السوق", "سوق"] },
  { key: "taxi", labels: ["تاكسي", "التاكسي"] },
  { key: "circulars", labels: ["التعاميم", "تعاميم"] },
  { key: "network", labels: ["الشبكة", "شبكة"] },
  { key: "community", labels: ["مجتمعي", "المجتمع", "مجتمع"] },
  { key: "profile", labels: ["ملفي", "الملف", "حسابي"] },
  { key: "install", labels: ["تثبيت التطبيق", "ثبت التطبيق", "تثبيت"] },
  { key: "worldcup", labels: ["كأس العالم", "كاس العالم", "المونديال"] }
];

function normalizeArabic(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isHomepage(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "" || path === "/";
}

function isAgent5Homepage(): boolean {
  return Boolean(document.querySelector('.kw-agent5-root'));
}

function isLegacyLauncherHomepage(): boolean {
  return Boolean(document.querySelector('.watany-drawer-page .watany-icon-grid .watany-app-icon'));
}

function isInsideUniversalMenu(element: HTMLElement | null): boolean {
  return Boolean(element?.closest('[data-watany-universal-feature-menu="true"]'));
}

function clearHomeOrderState(): void {
  const orderedCards = document.querySelectorAll<HTMLElement>('.watany-home-ordered-card');
  const orderedGrids = document.querySelectorAll<HTMLElement>('.watany-home-ordered-grid');

  orderedCards.forEach((card) => {
    card.classList.remove('watany-home-ordered-card');
    card.removeAttribute('data-watany-home-order');
    card.style.removeProperty('order');
  });

  orderedGrids.forEach((grid) => {
    grid.classList.remove('watany-home-ordered-grid');
  });

  document.documentElement.classList.remove('watany-home-grid-order-enabled');
}

function clearAgent5HomeOrder(): void {
  const orderedCards = document.querySelectorAll<HTMLElement>('.kw-agent5-root .watany-home-ordered-card');
  const orderedGrids = document.querySelectorAll<HTMLElement>('.kw-agent5-root .watany-home-ordered-grid, .kw-agent5-root.watany-home-ordered-grid, .kw-card-grid.watany-home-ordered-grid');

  orderedCards.forEach((card) => {
    card.classList.remove('watany-home-ordered-card');
    card.removeAttribute('data-watany-home-order');
    card.style.removeProperty('order');
  });

  orderedGrids.forEach((grid) => {
    grid.classList.remove('watany-home-ordered-grid');
  });
}

function findCardForLabel(label: string): HTMLElement | null {
  const normalizedLabel = normalizeArabic(label);

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "a",
        "button",
        "[role='button']",
        "[data-testid*='card']",
        "[class*='card']",
        "[class*='Card']",
        "[class*='tile']",
        "[class*='Tile']",
        "[class*='feature']",
        "[class*='Feature']"
      ].join(",")
    )
  );

  const exactMatches: HTMLElement[] = [];
  const containsMatches: HTMLElement[] = [];

  for (const element of candidates) {
    if (isInsideUniversalMenu(element)) continue;

    const text = normalizeArabic(element.innerText || element.textContent || "");
    if (!text) continue;

    if (text === normalizedLabel) {
      exactMatches.push(element);
    } else if (text.includes(normalizedLabel) && text.length <= Math.max(40, normalizedLabel.length + 20)) {
      containsMatches.push(element);
    }
  }

  const found = exactMatches[0] || containsMatches[0] || null;
  if (!found) return null;

  return closestCard(found);
}

function closestCard(element: HTMLElement): HTMLElement {
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    if (isInsideUniversalMenu(current)) {
      current = current.parentElement;
      continue;
    }

    const text = (current.innerText || current.textContent || "").trim();
    const rect = current.getBoundingClientRect();

    const looksLikeCard =
      current.tagName === "A" ||
      current.tagName === "BUTTON" ||
      current.getAttribute("role") === "button" ||
      /card|Card|tile|Tile|feature|Feature/.test(current.className.toString());

    const reasonableSize = rect.width >= 70 && rect.width <= window.innerWidth && rect.height >= 50 && rect.height <= 260;
    const notTooMuchText = text.length <= 90;

    if (looksLikeCard && reasonableSize && notTooMuchText) {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function findSharedGrid(cards: HTMLElement[]): HTMLElement | null {
  const parentCounts = new Map<HTMLElement, number>();

  for (const card of cards) {
    let current = card.parentElement;
    let depth = 0;

    while (current && current !== document.body && depth < 6) {
      parentCounts.set(current, (parentCounts.get(current) || 0) + 1);
      current = current.parentElement;
      depth++;
    }
  }

  let best: HTMLElement | null = null;
  let bestCount = 0;

  for (const [element, count] of parentCounts.entries()) {
    if (count > bestCount) {
      best = element;
      bestCount = count;
    }
  }

  return bestCount >= 6 ? best : null;
}

function applyHomeOrder(): void {
  if (!isHomepage()) return;

  if (isLegacyLauncherHomepage()) {
    clearHomeOrderState();
    return;
  }

  if (isAgent5Homepage()) {
    clearAgent5HomeOrder();
    clearHomeOrderState();
    return;
  }

  const orderedCards: HTMLElement[] = [];

  HOME_ORDER.forEach((item, index) => {
    let card: HTMLElement | null = null;

    for (const label of item.labels) {
      card = findCardForLabel(label);
      if (card) break;
    }

    if (!card) return;

    card.classList.add("watany-home-ordered-card");
    card.setAttribute("data-watany-home-order", String(index + 1));
    card.style.order = String(index + 1);
    orderedCards.push(card);
  });

  const grid = findSharedGrid(orderedCards);
  if (grid) {
    grid.classList.add("watany-home-ordered-grid");
  }

  document.documentElement.classList.add("watany-home-grid-order-enabled");
}

let scheduled = false;

function scheduleHomeOrder(): void {
  if (scheduled) return;
  scheduled = true;

  window.setTimeout(() => {
    scheduled = false;
    applyHomeOrder();
  }, 80);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyHomeOrder, { once: true });
  } else {
    applyHomeOrder();
  }

  window.addEventListener("resize", scheduleHomeOrder, { passive: true });
  window.addEventListener("orientationchange", scheduleHomeOrder, { passive: true });
  window.addEventListener("click", scheduleHomeOrder, { passive: true });

  const observer = new MutationObserver(scheduleHomeOrder);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}