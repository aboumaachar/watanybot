const CHAT_ROUTE_PREFIXES = [
  "/chat",
  "/group-chat",
  "/chat-sessions",
  "/saved",
  "/messages"
];

const CHAT_ROOT_SELECTORS = [
  "[data-chat-root]",
  "[data-chat-shell]",
  ".chat-page",
  ".chat-shell",
  ".chat-screen",
  ".chat-window",
  ".chat-container",
  ".chat-layout",
  ".chat-messages",
  ".chat-composer",
  ".group-chat-page",
  ".group-chat-shell",
  ".group-chat-container",
  ".conversation-panel",
  ".message-thread"
];

declare global {
  interface Window {
    __watanyChatViewportModeInstalled?: boolean;
  }
}

let lastStableViewportHeight = 0;
let disableChatViewportModeUntil = 0;

function isLikelyChatPath() {
  const pathname = globalThis.location.pathname || "/";
  // Canonical chat path is /chat; keep legacy support for /mobile-os/chat.
  if (pathname === "/chat" || pathname === "/mobile-os/chat") return true;
  if (pathname.startsWith("/groups/")) return true;
  return CHAT_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasChatDom() {
  return CHAT_ROOT_SELECTORS.some((selector) => Boolean(document.querySelector(selector)));
}

function setViewportVar() {
  const viewportHeight = globalThis.visualViewport?.height ?? 0;
  const innerHeight = globalThis.innerHeight || 0;
  const docHeight = document.documentElement?.clientHeight || 0;

  const bestCandidate = Math.max(viewportHeight, innerHeight, docHeight);
  const hasUsableHeight = bestCandidate >= 320;

  if (hasUsableHeight) {
    lastStableViewportHeight = bestCandidate;
  }

  let resolvedHeight = bestCandidate;
  if (!hasUsableHeight) {
    resolvedHeight = lastStableViewportHeight >= 320 ? lastStableViewportHeight : 800;
  }

  const height = Math.round(resolvedHeight);
  document.documentElement.style.setProperty("--watany-chat-vh", `${height}px`);
}

function shouldEnableChatMode() {
  if (Date.now() < disableChatViewportModeUntil) return false;
  return isLikelyChatPath() || hasChatDom();
}

function recoverFromCollapsedChatLayout() {
  if (!isLikelyChatPath()) return;
  if (!hasChatDom()) return;

  const rootHeight = document.getElementById("root")?.getBoundingClientRect().height ?? 0;
  const mainHeight = document.querySelector("main")?.getBoundingClientRect().height ?? 0;

  const isCollapsed = rootHeight < 220 || mainHeight < 120;
  if (!isCollapsed) return;

  // Temporarily fall back to standard layout if viewport mode collapses.
  disableChatViewportModeUntil = Date.now() + 2500;
  document.documentElement.classList.remove("watany-chat-viewport-mode");
  document.body?.classList.remove("watany-chat-viewport-mode");
  document.documentElement.style.setProperty("--watany-chat-vh", "100dvh");

  globalThis.setTimeout(applyMode, 2600);
}

function applyMode() {
  setViewportVar();
  const enabled = shouldEnableChatMode();
  document.documentElement.classList.toggle("watany-chat-viewport-mode", enabled);
  document.body?.classList.toggle("watany-chat-viewport-mode", enabled);
  globalThis.requestAnimationFrame(recoverFromCollapsedChatLayout);
}

function patchHistoryMethod(methodName: "pushState" | "replaceState") {
  const original = globalThis.history[methodName];
  globalThis.history[methodName] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    globalThis.setTimeout(applyMode, 0);
    return result;
  };
}

export function installWatanyChatViewportMode() {
  if (globalThis.window === undefined || globalThis.document === undefined) return;

  const runtimeWindow = globalThis.window;
  if (runtimeWindow.__watanyChatViewportModeInstalled) return;
  runtimeWindow.__watanyChatViewportModeInstalled = true;

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  globalThis.addEventListener("popstate", applyMode);
  globalThis.addEventListener("resize", applyMode);
  globalThis.visualViewport?.addEventListener("resize", applyMode);

  const observer = new MutationObserver(() => {
    globalThis.requestAnimationFrame(applyMode);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-route", "data-page"]
  });

  applyMode();
  globalThis.setTimeout(applyMode, 250);
  globalThis.setTimeout(applyMode, 1000);
}