type WatanyHybridScope = "default" | "social";

const INITIAL_PATHNAME = normalizePath(window.location.pathname || "/");
const FALLBACK_ROOT_ID = "watany-default-hybrid-chat-root";
const BRIDGE_ATTR = "data-watany-hybrid-bridge";
const BRIDGE_CHILD_ATTR = "data-watany-hybrid-bridge-child";
const SOCIAL_ROUTE_PATTERN = /^\/mcp\/(community|social|chat-groups|group-chats|rooms)(\/|$)/i;

let renderScheduled = false;
let historyPatched = false;

function normalizePath(pathname: string): string {
  const clean = (pathname || "/").replace(/\/+$/, "");
  return clean || "/";
}

function isMcpPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path.startsWith("/mcp/");
}

function getEffectivePathname(): string {
  const current = normalizePath(window.location.pathname || "/");
  if ((current === "/" || current === "") && isMcpPath(INITIAL_PATHNAME)) {
    return INITIAL_PATHNAME;
  }
  return current;
}

function getScope(): WatanyHybridScope {
  return SOCIAL_ROUTE_PATTERN.test(getEffectivePathname()) ? "social" : "default";
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function findDefaultLauncherForm(): HTMLFormElement | null {
  const forms = Array.from(
    document.querySelectorAll<HTMLFormElement>(
      [
        "form.sticky-hybrid-chat-launcher--expanded",
        "form[aria-label='اسأل موطني']",
        "form[aria-label=\"اسأل موطني\"]",
        "form[class*='sticky-hybrid-chat-launcher']"
      ].join(",")
    )
  );

  for (const form of forms) {
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input[placeholder='اسأل موطني...'], input[aria-label='اسأل موطني'], textarea[placeholder='اسأل موطني...'], textarea[aria-label='اسأل موطني']"
    );
    const send = form.querySelector<HTMLElement>(
      "button[type='submit'], .sticky-hybrid-chat-launcher__send, button[aria-label*='إرسال'], button[aria-label*='send']"
    );

    if (input && send && isVisible(form)) {
      return form;
    }
  }

  return null;
}

function removeFallbackShell(): void {
  const existing = document.getElementById(FALLBACK_ROOT_ID);
  existing?.remove();
}

function cleanupBridgeDecorations(): void {
  removeFallbackShell();

  const decorated = Array.from(document.querySelectorAll<HTMLElement>(`[${BRIDGE_ATTR}]`));
  for (const element of decorated) {
    element.removeAttribute(BRIDGE_ATTR);
    element.removeAttribute("data-testid");
    element.removeAttribute("data-chat-scope");
    element.removeAttribute("data-default-hybrid-chat-shell");
    element.removeAttribute("data-social-hybrid-chat-shell");
    element.removeAttribute("data-hybrid-assistant");
  }

  const children = Array.from(document.querySelectorAll<HTMLElement>(`[${BRIDGE_CHILD_ATTR}]`));
  for (const element of children) {
    element.removeAttribute(BRIDGE_CHILD_ATTR);
    element.removeAttribute("data-testid");
    element.removeAttribute("data-default-hybrid-chat-composer");
    element.removeAttribute("data-default-hybrid-chat-input");
    element.removeAttribute("data-default-hybrid-chat-send");
  }
}

function decorateDefaultLauncher(form: HTMLFormElement): void {
  removeFallbackShell();

  form.setAttribute(BRIDGE_ATTR, "decorated-default");
  form.setAttribute("data-testid", "watany-default-hybrid-chat-shell");
  form.setAttribute("data-chat-scope", "default");
  form.setAttribute("data-default-hybrid-chat-shell", "true");
  form.setAttribute("data-hybrid-assistant", "default");

  const input = form.querySelector<HTMLElement>(
    "input[placeholder='اسأل موطني...'], input[aria-label='اسأل موطني'], textarea[placeholder='اسأل موطني...'], textarea[aria-label='اسأل موطني']"
  );
  if (input) {
    input.setAttribute(BRIDGE_CHILD_ATTR, "default-input");
    input.setAttribute("data-testid", "watany-hybrid-chat-input");
    input.setAttribute("data-default-hybrid-chat-input", "true");
  }

  const send = form.querySelector<HTMLElement>(
    "button[type='submit'], .sticky-hybrid-chat-launcher__send, button[aria-label*='إرسال'], button[aria-label*='send']"
  );
  if (send) {
    send.setAttribute(BRIDGE_CHILD_ATTR, "default-send");
    send.setAttribute("data-testid", "watany-hybrid-chat-send");
    send.setAttribute("data-default-hybrid-chat-send", "true");
  }
}

function createDefaultFallbackShell(): HTMLElement {
  const root = document.createElement("section");
  root.id = FALLBACK_ROOT_ID;
  root.className = "watany-default-hybrid-chat-shell watany-default-hybrid-chat-shell--default";
  root.setAttribute("dir", "rtl");
  root.setAttribute(BRIDGE_ATTR, "fallback-default");
  root.setAttribute("data-testid", "watany-default-hybrid-chat-shell");
  root.setAttribute("data-chat-scope", "default");
  root.setAttribute("data-default-hybrid-chat-shell", "true");
  root.setAttribute("data-hybrid-assistant", "default");

  root.innerHTML = `
    <div class="watany-default-hybrid-chat-composer" data-testid="watany-default-hybrid-chat-composer" data-default-hybrid-chat-composer="true" data-watany-hybrid-bridge-child="default-composer">
      <div class="watany-hybrid-chat-composer-inner" data-testid="watany-hybrid-chat-composer">
        <button class="watany-default-hybrid-chat-send" type="button" aria-label="إرسال" data-testid="watany-hybrid-chat-send" data-default-hybrid-chat-send="true">←</button>
        <input
          data-testid="watany-hybrid-chat-input"
          data-default-hybrid-chat-input="true"
          aria-label="اسأل موطني"
          placeholder="اسأل موطني..."
          autocomplete="off"
        />
        <button class="watany-default-hybrid-chat-mic" type="button" aria-label="صوت" data-testid="watany-hybrid-chat-mic">🎙</button>
      </div>
    </div>
  `;

  return root;
}

function createSocialFallbackShell(): HTMLElement {
  const root = document.createElement("section");
  root.id = FALLBACK_ROOT_ID;
  root.className = "watany-default-hybrid-chat-shell watany-default-hybrid-chat-shell--social";
  root.setAttribute("dir", "rtl");
  root.setAttribute(BRIDGE_ATTR, "fallback-social");
  root.setAttribute("data-testid", "watany-social-hybrid-chat-shell");
  root.setAttribute("data-chat-scope", "social");
  root.setAttribute("data-social-hybrid-chat-shell", "true");
  root.setAttribute("data-hybrid-assistant", "social");

  root.innerHTML = `
    <div class="watany-default-hybrid-chat-pill" data-testid="watany-community-chat-scope" data-watany-hybrid-bridge-child="social-pill">
      <span class="watany-default-hybrid-chat-dot"></span>
      <span>دردشة المجتمع</span>
    </div>
  `;

  return root;
}

function ensureFallbackShell(scope: WatanyHybridScope): void {
  const existing = document.getElementById(FALLBACK_ROOT_ID);
  if (existing?.getAttribute("data-chat-scope") === scope && isVisible(existing)) {
    return;
  }

  existing?.remove();
  const next = scope === "social" ? createSocialFallbackShell() : createDefaultFallbackShell();
  document.body.appendChild(next);
}

function renderWatanyHybridContractShell(): void {
  if (!document.body) return;

  const effectivePath = getEffectivePathname();
  if (!isMcpPath(effectivePath)) {
    cleanupBridgeDecorations();
    return;
  }

  const scope = getScope();
  if (scope === "social") {
    cleanupBridgeDecorations();
    ensureFallbackShell("social");
    return;
  }

  const launcher = findDefaultLauncherForm();
  if (launcher) {
    decorateDefaultLauncher(launcher);
    return;
  }

  ensureFallbackShell("default");
}

function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;

  window.requestAnimationFrame(() => {
    renderScheduled = false;
    renderWatanyHybridContractShell();
  });
}

function patchHistoryMethod(methodName: "pushState" | "replaceState"): void {
  const historyObject = window.history as unknown as Record<string, (...args: unknown[]) => unknown>;
  const original = historyObject[methodName];
  if (typeof original !== "function") return;

  historyObject[methodName] = function patchedHistoryMethod(...args: unknown[]): unknown {
    const result = original.apply(window.history, args);
    scheduleRender();
    return result;
  };
}

export function mountWatanyDefaultHybridChatShell(): void {
  renderWatanyHybridContractShell();

  if (!historyPatched) {
    historyPatched = true;
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");
    window.addEventListener("popstate", scheduleRender);
    window.addEventListener("hashchange", scheduleRender);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setTimeout(renderWatanyHybridContractShell, 80);
  window.setTimeout(renderWatanyHybridContractShell, 350);
}
