const TABLIST_SELECTOR = ".sc-result-tabs, .dis-tabs, .auth-tabs, .admin-tabs, [role=\"tablist\"]";
const TAB_SELECTOR = "button, [role='tab'], .dis-tab, .auth-tab, .admin-tab";
const CYCLE_MS = 1600;

type TabHintEntry = {
  indicator: HTMLDivElement;
  index: number;
  timerId: ReturnType<typeof globalThis.setInterval> | null;
  onClick: (event: Event) => void;
};

function isVisible(element: HTMLElement): boolean {
  const style = globalThis.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getTabs(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>(TAB_SELECTOR)).filter((tab) => {
    if (tab.closest(".tab-cycle-hint") || tab.closest(".tab-cycle-hint__glyph")) return false;
    return isVisible(tab);
  });
}

function positionIndicator(host: HTMLElement, entry: TabHintEntry): void {
  const tabs = getTabs(host);
  if (tabs.length < 2) {
    entry.indicator.style.display = "none";
    return;
  }

  entry.indicator.style.display = "block";
  if (entry.index >= tabs.length) {
    entry.index = 0;
  }

  const target = tabs[entry.index];
  const hostRect = host.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = targetRect.left - hostRect.left + (targetRect.width / 2) + host.scrollLeft;
  entry.indicator.style.setProperty("--tab-hint-x", `${x}px`);
}

function createIndicator(): HTMLDivElement {
  const indicator = document.createElement("div");
  indicator.className = "tab-cycle-hint";
  indicator.setAttribute("aria-hidden", "true");

  const glyph = document.createElement("span");
  glyph.className = "tab-cycle-hint__glyph";
  glyph.textContent = "▼";
  indicator.appendChild(glyph);
  return indicator;
}

export function installTabCycleHint(): void {
  if (typeof document === "undefined") return;

  const entries = new Map<HTMLElement, TabHintEntry>();

  const attach = (host: HTMLElement) => {
    if (entries.has(host)) return;

    const tabs = getTabs(host);
    if (tabs.length < 2) return;

    const indicator = createIndicator();
    host.classList.add("tab-cycle-hint-host");
    host.appendChild(indicator);

    const entry: TabHintEntry = {
      indicator,
      index: 1,
      timerId: null,
      onClick: () => {},
    };

    entry.onClick = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(TAB_SELECTOR);
      if (!target) return;
      const currentTabs = getTabs(host);
      const clickedIndex = currentTabs.indexOf(target);
      if (clickedIndex < 0) return;
      entry.index = (clickedIndex + 1) % currentTabs.length;
      positionIndicator(host, entry);
    };

    host.addEventListener("click", entry.onClick);
    entry.timerId = globalThis.setInterval(() => {
      const currentTabs = getTabs(host);
      if (currentTabs.length < 2) {
        entry.indicator.style.display = "none";
        return;
      }
      entry.index = (entry.index + 1) % currentTabs.length;
      positionIndicator(host, entry);
    }, CYCLE_MS);

    entries.set(host, entry);
    positionIndicator(host, entry);
  };

  const detach = (host: HTMLElement) => {
    const entry = entries.get(host);
    if (!entry) return;

    if (entry.timerId !== null) {
      globalThis.clearInterval(entry.timerId);
    }
    host.removeEventListener("click", entry.onClick);
    entry.indicator.remove();
    host.classList.remove("tab-cycle-hint-host");
    entries.delete(host);
  };

  const sync = () => {
    const hosts = Array.from(document.querySelectorAll<HTMLElement>(TABLIST_SELECTOR));
    const hostSet = new Set(hosts);

    hosts.forEach((host) => attach(host));
    Array.from(entries.keys()).forEach((host) => {
      if (!hostSet.has(host) || !document.body.contains(host)) {
        detach(host);
        return;
      }
      const entry = entries.get(host);
      if (entry) positionIndicator(host, entry);
    });
  };

  const mutationObserver = new MutationObserver(() => sync());
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  globalThis.addEventListener("resize", sync, { passive: true });
  globalThis.addEventListener("orientationchange", sync, { passive: true });

  sync();
}
