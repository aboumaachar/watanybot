export {};

const PLATFORM_CLASS = "watany-platform-v3";
const BRAND_URL = "/watany/brand/logo.png";
const ENABLE_AGGRESSIVE_HOME_GRID = false;
const ENABLE_GEOMETRY_TOPBAR_FALLBACK = true;
const ENABLE_OWNED_TOPBAR_FALLBACK = false;

const normalizeText = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const isVisible = (element: Element): boolean => {
  const node = element as HTMLElement;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);

  return (
    rect.width > 1 &&
    rect.height > 1 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
};

const shortText = (element: Element): string =>
  normalizeText(element.textContent).slice(0, 180);

const removeMarker = (attribute: string): void => {
  for (const element of Array.from(
    document.querySelectorAll(`[${attribute}]`)
  )) {
    element.removeAttribute(attribute);
  }
};

const elementDepth = (element: Element): number => {
  let depth = 0;
  let current: Element | null = element;

  while (current?.parentElement) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
};

const topbarCandidateScore = (
  element: HTMLElement,
  sourceBonus: number
): number => {
  const rect = element.getBoundingClientRect();

  const actionCount = element.querySelectorAll(
    "button, a, [role='button']"
  ).length;

  const oversizedVisualCount = Array.from(
    element.querySelectorAll("img, svg")
  ).filter((visual) => {
    if (!isVisible(visual)) return false;

    const visualRect = visual.getBoundingClientRect();

    return (
      visualRect.width >= window.innerWidth * 0.45 ||
      visualRect.height >= 110
    );
  }).length;

  let score = sourceBonus;

  score += Math.max(0, 100 - Math.abs(rect.top));
  score += rect.height <= 110 ? 40 : 0;
  score += rect.height >= 44 ? 15 : 0;
  score += actionCount >= 1 && actionCount <= 18 ? 40 : 0;
  score += rect.width >= window.innerWidth * 0.90 ? 35 : 0;
  score += rect.bottom <= 240 ? 20 : 0;
  score -= oversizedVisualCount * 80;
  score -= Math.max(0, rect.height - 120);

  return score;
};

const geometryTopbarCandidates = (): HTMLElement[] => {
  if (!ENABLE_GEOMETRY_TOPBAR_FALLBACK) return [];

  const selectors = [
    "body > *",
    "#root > *",
    "#root > * > *",
    "#root > * > * > *",
  ].join(",");

  return Array.from(
    document.querySelectorAll(selectors)
  ).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();

    if (
      rect.width < window.innerWidth * 0.68 ||
      rect.width > window.innerWidth * 1.10 ||
      rect.height < 32 ||
      rect.height > 220 ||
      rect.bottom < 0 ||
      rect.top > 220
    ) {
      return false;
    }

    const actionCount = element.querySelectorAll(
      "button, a, [role='button']"
    ).length;

    return actionCount >= 1 && actionCount <= 24;
  });
};

const findTopbar = (): HTMLElement | null => {
  const structuralSelectors = [
    "header",
    '[role="banner"]',
    '[class*="topbar" i]',
    '[class*="top-bar" i]',
    '[class*="app-header" i]',
    '[class*="header" i]',
  ].join(",");

  const structural = Array.from(
    document.querySelectorAll(structuralSelectors)
  ).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();

    return (
      rect.width >= window.innerWidth * 0.60 &&
      rect.height >= 36 &&
      rect.height <= 180 &&
      rect.bottom >= 0 &&
      rect.top <= 180
    );
  });

  const combined = Array.from(
    new Set<HTMLElement>([
      ...structural,
      ...geometryTopbarCandidates(),
    ])
  );

  const ranked = combined
    .map((element) => ({
      element,
      score: topbarCandidateScore(
        element,
        structural.includes(element) ? 45 : 0
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0]?.element ?? null;

  if (selected) return selected;

  const actionCandidates = Array.from(
    document.querySelectorAll(
      "button, a, [role='button']"
    )
  ).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();

    return (
      rect.top <= 180 &&
      rect.bottom >= 0 &&
      rect.width >= 24 &&
      rect.height >= 24
    );
  });

  for (const action of actionCandidates) {
    let ancestor = action.parentElement;
    let depth = 0;

    while (ancestor && depth < 5) {
      const rect = ancestor.getBoundingClientRect();

      if (
        isVisible(ancestor) &&
        rect.width >= window.innerWidth * 0.68 &&
        rect.height >= 32 &&
        rect.height <= 220 &&
        rect.top <= 220
      ) {
        return ancestor;
      }

      ancestor = ancestor.parentElement;
      depth += 1;
    }
  }

  if (!ENABLE_OWNED_TOPBAR_FALLBACK) return null;

  const existingOwned = document.querySelector(
    "[data-watany-owned-topbar='true']"
  );

  if (existingOwned instanceof HTMLElement) {
    return existingOwned;
  }

  const owned = document.createElement("header");
  owned.setAttribute("data-watany-owned-topbar", "true");
  owned.setAttribute("role", "banner");

  const mount =
    document.querySelector("#root") ??
    document.body;

  mount.prepend(owned);

  return owned;
};
const ensureBrand = (topbar: HTMLElement): void => {
  removeMarker("data-watany-brand-mark");

  const exactExisting = Array.from(
    topbar.querySelectorAll("img")
  ).find((image) => {
    const source = String(
      image.getAttribute("src") ?? ""
    );

    return source === BRAND_URL;
  });

  let brand: HTMLImageElement;

  if (exactExisting instanceof HTMLImageElement) {
    brand = exactExisting;
  } else {
    brand = document.createElement("img");
    brand.alt = "موطني";
    brand.decoding = "async";
    brand.setAttribute("src", BRAND_URL);
    topbar.prepend(brand);
  }

  brand.setAttribute("data-watany-brand-mark", "true");
};

const looksLikeBrandImage = (
  image: HTMLImageElement
): boolean => {
  const source = String(
    image.getAttribute("src") ?? ""
  ).toLowerCase();

  const alternate = normalizeText(
    image.getAttribute("alt")
  );

  return (
    source.includes("logo") ||
    source.includes("watany") ||
    alternate.includes("موطني")
  );
};

const dropOversizedDuplicateBrandArt = (): void => {
  if (location.pathname !== "/") return;

  for (const image of Array.from(
    document.querySelectorAll("img")
  )) {
    if (!(image instanceof HTMLImageElement)) continue;
    if (!isVisible(image)) continue;
    if (image.matches("[data-watany-brand-mark]")) continue;
    if (!looksLikeBrandImage(image)) continue;

    const rect = image.getBoundingClientRect();

    if (
      rect.width >= window.innerWidth * 0.55 &&
      rect.height >= 120
    ) {
      image.hidden = true;
      image.setAttribute("aria-hidden", "true");
      image.setAttribute(
        "data-watany-dropped-oversized-brand-art",
        "true"
      );
    }
  }
};

const tagTicker = (topbar: HTMLElement): void => {
  removeMarker("data-watany-ticker");
  removeMarker("data-watany-ticker-link");

  const candidates = Array.from(
    document.querySelectorAll(
      "div, p, section, nav, aside"
    )
  ).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();
    const text = shortText(element);
    const anchors = element.querySelectorAll("a").length;

    return (
      text.length >= 18 &&
      text.length <= 360 &&
      anchors >= 1 &&
      anchors <= 10 &&
      rect.width >= window.innerWidth * 0.55 &&
      rect.height >= 18 &&
      rect.height <= 110
    );
  });

  const ranked = candidates
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const anchors = element.querySelectorAll("a").length;
      let score = 0;

      score += anchors * 12;
      score += rect.width >= window.innerWidth * 0.85 ? 30 : 0;
      score += rect.height <= 70 ? 30 : 0;
      score += topbar.contains(element) ? 35 : 0;
      score += rect.top <= 260 ? 20 : 0;
      score -= Math.max(0, rect.height - 70);

      return { element, score };
    })
    .sort((a, b) => b.score - a.score);

  const ticker = ranked[0]?.element ?? null;

  if (!ticker) return;

  ticker.setAttribute("data-watany-ticker", "true");

  for (const anchor of Array.from(
    ticker.querySelectorAll("a")
  )) {
    anchor.setAttribute(
      "data-watany-ticker-link",
      "true"
    );
  }
};

const tagSearch = (): void => {
  removeMarker("data-watany-search");

  for (const input of Array.from(
    document.querySelectorAll("input")
  )) {
    if (!(input instanceof HTMLInputElement)) continue;
    if (!isVisible(input)) continue;

    const placeholder = normalizeText(input.placeholder);

    if (
      placeholder.includes("بحث") ||
      placeholder.includes("ابحث") ||
      input.type === "search"
    ) {
      input.setAttribute("data-watany-search", "true");
    }
  }
};

const tagChatDock = (): void => {
  removeMarker("data-watany-chat-dock");

  const fields = Array.from(
    document.querySelectorAll("input, textarea")
  ).filter((field) => {
    if (!isVisible(field)) return false;

    const placeholder = normalizeText(
      field.getAttribute("placeholder")
    );

    return (
      placeholder.includes("اسأل موطني") ||
      placeholder.includes("اسال موطني")
    );
  });

  for (const field of fields) {
    const container = field.closest(
      "form, [class*='chat' i], [class*='composer' i], [class*='input-bar' i]"
    ) ?? field.parentElement;

    if (container instanceof HTMLElement) {
      container.setAttribute(
        "data-watany-chat-dock",
        "true"
      );
    }
  }
};

const visualSelector = [
  "img",
  "svg",
  "[data-icon]",
  "[class*='icon' i]",
  "[class*='glyph' i]",
  "[class*='symbol' i]",
].join(",");

const hasVisualSignal = (element: Element): boolean => {
  const known = element.querySelector(visualSelector);

  if (known && isVisible(known)) return true;

  const ownStyle = getComputedStyle(element);

  if (ownStyle.backgroundImage !== "none") return true;

  for (const child of Array.from(element.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!isVisible(child)) continue;

    const rect = child.getBoundingClientRect();
    const style = getComputedStyle(child);

    if (
      rect.width >= 24 &&
      rect.width <= 130 &&
      rect.height >= 24 &&
      rect.height <= 130 &&
      (
        style.backgroundImage !== "none" ||
        normalizeText(child.textContent).length === 0
      )
    ) {
      return true;
    }
  }

  return false;
};

const collectHomeTileCandidates = (
  main: Element
): HTMLElement[] => {
  const selectorParts = [
    "a",
    "button",
    "[role='button']",
    "[tabindex='0']",
    "article",
    "li",
    "[class*='feature' i]",
    "[class*='service' i]",
    "[class*='menu-item' i]",
    "[class*='menuitem' i]",
    "[class*='tile' i]",
    "[class*='card' i]",
    "[class*='item' i]",
  ];

  if (ENABLE_AGGRESSIVE_HOME_GRID) {
    selectorParts.push("div", "section");
  }

  const raw = Array.from(
    main.querySelectorAll(selectorParts.join(","))
  ).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isVisible(element)) return false;
    if (element.closest("[data-watany-topbar]")) return false;
    if (element.closest("[data-watany-chat-dock]")) return false;
    if (element.closest("[data-watany-ticker]")) return false;

    const text = shortText(element);
    if (text.length < 1 || text.length > 96) return false;

    const rect = element.getBoundingClientRect();

    if (
      rect.width < 38 ||
      rect.height < 38 ||
      rect.width > window.innerWidth * 0.75 ||
      rect.height > 280
    ) {
      return false;
    }

    return hasVisualSignal(element);
  });

  const byArea = raw
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        area: rect.width * rect.height,
        depth: elementDepth(element),
      };
    })
    .sort((a, b) => {
      if (a.area !== b.area) return a.area - b.area;
      return b.depth - a.depth;
    });

  const selected: HTMLElement[] = [];

  for (const row of byArea) {
    const wrapsSelected = selected.some(
      (existing) =>
        row.element !== existing &&
        row.element.contains(existing)
    );

    if (wrapsSelected) continue;

    selected.push(row.element);
  }

  return selected;
};

type GroupScore = {
  container: HTMLElement;
  items: HTMLElement[];
  score: number;
  strategy: string;
};

const estimateColumnCount = (
  items: HTMLElement[]
): number => {
  if (items.length < 2) return items.length;

  const lefts = items
    .map((item) => item.getBoundingClientRect().left)
    .sort((a, b) => a - b);

  const widths = items
    .map((item) => item.getBoundingClientRect().width)
    .sort((a, b) => a - b);

  const medianWidth =
    widths[Math.floor(widths.length / 2)] || 60;

  const threshold = Math.max(16, medianWidth * 0.42);
  const clusters: number[] = [];

  for (const left of lefts) {
    const existing = clusters.findIndex(
      (value) => Math.abs(value - left) <= threshold
    );

    if (existing < 0) {
      clusters.push(left);
    } else {
      clusters[existing] =
        (clusters[existing] + left) / 2;
    }
  }

  return clusters.length;
};

const scoreGroup = (
  container: HTMLElement,
  items: HTMLElement[],
  strategy: string
): GroupScore | null => {
  const unique = Array.from(new Set(items))
    .filter((item) => container.contains(item));

  if (unique.length < 6) return null;

  const maxCount = ENABLE_AGGRESSIVE_HOME_GRID ? 60 : 40;
  if (unique.length > maxCount) return null;

  const rect = container.getBoundingClientRect();

  if (
    rect.width < window.innerWidth * 0.52 ||
    rect.width > window.innerWidth * 1.20 ||
    rect.height < 100 ||
    rect.height > 3200
  ) {
    return null;
  }

  const directCount = unique.filter(
    (item) => item.parentElement === container
  ).length;

  const columns = estimateColumnCount(unique);
  const descendantCount = container.querySelectorAll("*").length;

  let score = 0;

  score += Math.min(unique.length, 18) * 7;
  score += unique.length >= 9 && unique.length <= 18 ? 55 : 0;
  score += columns === 3 ? 90 : 0;
  score += columns >= 2 && columns <= 4 ? 35 : 0;
  score += Math.round((directCount / unique.length) * 80);
  score += rect.width >= window.innerWidth * 0.82 ? 30 : 0;
  score -= Math.max(0, descendantCount - 180) * 0.15;
  score -= strategy === "ancestor" ? 18 : 0;

  return {
    container,
    items: unique,
    score,
    strategy,
  };
};

const chooseHomeGrid = (
  candidates: HTMLElement[]
): GroupScore | null => {
  const groups: GroupScore[] = [];

  const directMap = new Map<HTMLElement, HTMLElement[]>();

  for (const candidate of candidates) {
    const parent = candidate.parentElement;

    if (!parent) continue;

    const current = directMap.get(parent) ?? [];
    current.push(candidate);
    directMap.set(parent, current);
  }

  for (const [container, items] of directMap.entries()) {
    const scored = scoreGroup(
      container,
      items,
      "direct-parent"
    );

    if (scored) groups.push(scored);
  }

  const ancestorMap =
    new Map<HTMLElement, Set<HTMLElement>>();

  for (const candidate of candidates) {
    let ancestor = candidate.parentElement;
    let depth = 0;

    while (ancestor && depth < 5) {
      if (
        ancestor.matches(
          "[data-watany-topbar], [data-watany-chat-dock], [data-watany-ticker]"
        )
      ) {
        break;
      }

      const set =
        ancestorMap.get(ancestor) ??
        new Set<HTMLElement>();

      set.add(candidate);
      ancestorMap.set(ancestor, set);

      ancestor = ancestor.parentElement;
      depth += 1;
    }
  }

  for (const [container, set] of ancestorMap.entries()) {
    const scored = scoreGroup(
      container,
      Array.from(set),
      "ancestor"
    );

    if (scored) groups.push(scored);
  }

  groups.sort((a, b) => b.score - a.score);

  return groups[0] ?? null;
};

const markHomeGrid = (
  group: GroupScore
): void => {
  const { container } = group;

  container.setAttribute(
    "data-watany-icon-grid",
    "true"
  );

  container.setAttribute(
    "data-watany-grid-binding-strategy",
    group.strategy
  );

  const sortedItems = [...group.items]
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();

      if (Math.abs(ar.top - br.top) > 8) {
        return ar.top - br.top;
      }

      return br.left - ar.left;
    })
    .slice(0, 18);

  for (const item of sortedItems) {
    item.setAttribute(
      "data-watany-icon-tile",
      "true"
    );

    const knownArt = item.querySelector(visualSelector);

    let art: Element | null = knownArt;

    if (!art) {
      art = Array.from(item.children).find((child) => {
        if (!(child instanceof HTMLElement)) return false;
        if (!isVisible(child)) return false;

        const rect = child.getBoundingClientRect();
        const style = getComputedStyle(child);

        return (
          rect.width >= 24 &&
          rect.width <= 130 &&
          rect.height >= 24 &&
          rect.height <= 130 &&
          (
            style.backgroundImage !== "none" ||
            normalizeText(child.textContent).length === 0
          )
        );
      }) ?? null;
    }

    if (
      art instanceof HTMLElement ||
      art instanceof SVGElement
    ) {
      art.setAttribute(
        "data-watany-icon-art",
        "true"
      );
    }

    const labels = Array.from(
      item.querySelectorAll(
        "span, strong, p, small"
      )
    ).filter((node) => {
      const text = shortText(node);
      return text.length >= 1 && text.length <= 56;
    });

    const label = labels
      .sort((a, b) => {
        const aText = shortText(a);
        const bText = shortText(b);
        return bText.length - aText.length;
      })[0];

    if (label instanceof HTMLElement) {
      label.setAttribute(
        "data-watany-icon-label",
        "true"
      );
    }
  }
};

const tagHomeIconGrid = (): void => {
  if (location.pathname !== "/") return;

  removeMarker("data-watany-icon-grid");
  removeMarker("data-watany-icon-tile");
  removeMarker("data-watany-icon-art");
  removeMarker("data-watany-icon-label");

  const main =
    document.querySelector("main") ??
    document.querySelector("[role='main']") ??
    document.body;

  const candidates = collectHomeTileCandidates(main);
  const group = chooseHomeGrid(candidates);

  document.documentElement.dataset.watanyGridCandidateCount =
    String(candidates.length);

  if (!group) {
    document.documentElement.dataset.watanyGridBindingStrategy =
      ENABLE_AGGRESSIVE_HOME_GRID
        ? "aggressive-none"
        : "structural-none";
    return;
  }

  markHomeGrid(group);

  document.documentElement.dataset.watanyGridBindingStrategy =
    `${ENABLE_AGGRESSIVE_HOME_GRID ? "aggressive" : "structural"}:${group.strategy}`;
};

const dropHomeCarousel = (): void => {
  if (location.pathname !== "/") return;

  for (const carousel of Array.from(
    document.querySelectorAll(
      '[class*="carousel" i], [data-carousel], [data-watany-carousel]'
    )
  ).filter(isVisible)) {
    if (!(carousel instanceof HTMLElement)) continue;

    carousel.hidden = true;
    carousel.setAttribute("aria-hidden", "true");
    carousel.setAttribute(
      "data-watany-dropped-carousel",
      "true"
    );
  }
};

const tagActions = (): void => {
  removeMarker("data-watany-primary-action");
  removeMarker("data-watany-secondary-action");

  const controls = Array.from(
    document.querySelectorAll(
      'button, a[role="button"], input[type="submit"], input[type="button"]'
    )
  ).filter(isVisible);

  for (const control of controls) {
    const text = shortText(control);

    const primary = [
      "تسجيل الدخول",
      "ابدأ",
      "متابعة",
      "احسب",
      "إرسال",
      "تأكيد",
      "حفظ",
    ].some((token) => text.includes(token));

    const secondary = [
      "كزائر",
      "لاحقاً",
      "إلغاء",
      "رجوع",
    ].some((token) => text.includes(token));

    if (primary && control instanceof HTMLElement) {
      control.setAttribute(
        "data-watany-primary-action",
        "true"
      );
    } else if (
      secondary &&
      control instanceof HTMLElement
    ) {
      control.setAttribute(
        "data-watany-secondary-action",
        "true"
      );
    }
  }
};

const tagServiceCards = (): void => {
  removeMarker("data-watany-service-card");

  const candidates = Array.from(
    document.querySelectorAll(
      "article, li, a, [role='button']"
    )
  ).filter((element) => {
    if (!isVisible(element)) return false;
    if (element.matches("[data-watany-icon-tile]")) return false;
    if (element.closest("[data-watany-icon-grid]")) return false;

    const text = shortText(element);
    if (text.length < 24 || text.length > 260) return false;

    const hasHeading = Boolean(
      element.querySelector("h2, h3, h4, strong")
    );

    return hasHeading && hasVisualSignal(element);
  });

  for (const candidate of candidates.slice(0, 40)) {
    if (candidate instanceof HTMLElement) {
      candidate.setAttribute(
        "data-watany-service-card",
        "true"
      );
    }
  }
};

let queued = false;

const adapt = (): void => {
  queued = false;

  const root = document.documentElement;

  root.classList.add(PLATFORM_CLASS);
  root.dir = "rtl";
  root.dataset.watanyRoute =
    location.pathname || "/";

  removeMarker("data-watany-topbar");

  const topbar = findTopbar();

  if (topbar) {
    topbar.setAttribute(
      "data-watany-topbar",
      "true"
    );

    ensureBrand(topbar);
    tagTicker(topbar);
  }

  tagSearch();
  tagChatDock();
  dropHomeCarousel();
  dropOversizedDuplicateBrandArt();
  tagHomeIconGrid();
  tagActions();
  tagServiceCards();

  root.dataset.watanyAdaptedAt =
    String(Date.now());
};

const queueAdapt = (): void => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(adapt);
};

const scheduleSettledAdapt = (): void => {
  for (const delay of [0, 120, 350, 800, 1500]) {
    window.setTimeout(queueAdapt, delay);
  }
};

const themeObserver = new MutationObserver(queueAdapt);

themeObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [
    "src",
    "class",
    "hidden",
    "aria-hidden",
  ],
});

const layoutObserver = new ResizeObserver(queueAdapt);
layoutObserver.observe(document.documentElement);

window.addEventListener("popstate", scheduleSettledAdapt);
window.addEventListener("hashchange", scheduleSettledAdapt);
window.addEventListener("load", scheduleSettledAdapt);
window.addEventListener("pageshow", scheduleSettledAdapt);

document.addEventListener(
  "load",
  (event) => {
    if (event.target instanceof HTMLImageElement) {
      scheduleSettledAdapt();
    }
  },
  true
);

document.addEventListener("click", () => {
  window.setTimeout(scheduleSettledAdapt, 0);
});

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    scheduleSettledAdapt,
    { once: true }
  );
} else {
  scheduleSettledAdapt();
}