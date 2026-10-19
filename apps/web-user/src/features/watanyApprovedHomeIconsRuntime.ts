/* APEX_APPROVED_ICONS_RUNTIME_TAGGER_V2_SCOPE_SAFE */

const EXACT_VIEWER_ASSET_BY_KEY: Record<string, string> = {};

function resolveExactViewerAsset(card: HTMLElement): string | undefined {
  const featureKey = card.dataset.saFeature;
  if (featureKey && EXACT_VIEWER_ASSET_BY_KEY[featureKey]) {
    return EXACT_VIEWER_ASSET_BY_KEY[featureKey];
  }

  const href = card.getAttribute("href");
  if (href) {
    try {
      const parsed = new URL(href, window.location.origin);
      if (EXACT_VIEWER_ASSET_BY_KEY[parsed.pathname]) {
        return EXACT_VIEWER_ASSET_BY_KEY[parsed.pathname];
      }
    } catch {
      // Ignore malformed href and continue to fallback resolution.
    }
  }

  return undefined;
}

function getOrCreateRuntimeAssetImage(tile: HTMLElement): HTMLImageElement {
  const existingAsset = tile.querySelector<HTMLImageElement>("img.watany-approved-runtime-asset");
  if (existingAsset) {
    return existingAsset;
  }

  const created = document.createElement("img");
  created.className = "watany-approved-runtime-asset";
  created.alt = "";
  created.setAttribute("aria-hidden", "true");
  created.decoding = "async";
  created.loading = "eager";
  tile.appendChild(created);
  return created;
}

function clearExactViewerRendering(card: HTMLElement, tile: HTMLElement): void {
  delete card.dataset.watanyAssetRender;
  const existingAsset = tile.querySelector<HTMLImageElement>("img.watany-approved-runtime-asset");
  if (existingAsset) {
    existingAsset.remove();
  }
}

function applyExactViewerRendering(card: HTMLElement, tile: HTMLElement, assetSrc: string): void {
  card.dataset.watanyAssetRender = "exact-viewer";
  delete card.dataset.watanyIconRender;
  delete card.dataset.sign;
  delete tile.dataset.sign;

  const assetImage = getOrCreateRuntimeAssetImage(tile);
  assetImage.src = assetSrc;
}

function applyWatanyApprovedHomeIconClasses(): void {
  if (typeof document === "undefined" || !document.body) {
    return;
  }

  const root = document.querySelector<HTMLElement>(
    '.watany-drawer-page[data-watany-feature="home"][data-watany-launcher-theme="golden-green-v1"]'
  );
  if (!root) {
    return;
  }

  document.body.classList.add("watany-approved-icons-runtime-enabled");

  const cards = Array.from(root.querySelectorAll<HTMLElement>(".watany-icon-grid .watany-app-icon, .sa-home-icons .watany-app-icon"));
  for (const card of cards) {
    const tile = card.querySelector<HTMLElement>(".watany-app-icon__tile");
    const glyph = card.querySelector<HTMLElement>(".watany-app-icon__glyph");
    const label = card.querySelector<HTMLElement>(".watany-app-icon__label");
    card.classList.add("watany-approved-runtime-card");
    if (tile) {
      tile.classList.add("watany-approved-runtime-tile");
    }
    if (glyph) {
      glyph.classList.add("watany-approved-runtime-glyph");
    }
    if (label) {
      label.classList.add("watany-approved-runtime-label");
    }

    if (!tile) {
      continue;
    }

    const exactAsset = resolveExactViewerAsset(card);
    if (!exactAsset) {
      clearExactViewerRendering(card, tile);
      continue;
    }

    applyExactViewerRendering(card, tile, exactAsset);
  }
}

if (typeof window !== "undefined") {
  const run = () => {
    window.requestAnimationFrame(applyWatanyApprovedHomeIconClasses);
    window.setTimeout(applyWatanyApprovedHomeIconClasses, 120);
    window.setTimeout(applyWatanyApprovedHomeIconClasses, 600);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  window.addEventListener("popstate", run);
  window.addEventListener("hashchange", run);
}

export {};