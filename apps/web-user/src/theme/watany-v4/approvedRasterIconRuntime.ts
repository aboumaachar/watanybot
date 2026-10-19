import { WATANY_V4_ICONS, type WatanyV4IconName } from "./iconRegistry";

type Mapping = { key: WatanyV4IconName; id: string; label: string };
const mappings: Mapping[] = [
  { key: "most-requested", id: "most-requested", label: "الأكثر طلباً" },
  { key: "latest", id: "latest", label: "الأحدث" },
  { key: "for-you", id: "for-you", label: "ممكن يهمك" },
  { key: "login", id: "login", label: "الدخول" },
  { key: "profile", id: "profile", label: "الملف" },
  { key: "profile", id: "bookmarks", label: "المرجعيات" },
  { key: "profile", id: "saved", label: "المحفوظات" },
  { key: "profile", id: "settings", label: "الإعدادات" },
  { key: "install", id: "install", label: "تثبيت التطبيق" },
  { key: "documents", id: "documents", label: "مستنداتي" },
  { key: "notifications", id: "notifications", label: "الإشعارات" },
  { key: "messages", id: "messages", label: "الرسائل" },
  { key: "messages", id: "saved-chats", label: "المحادثات المحفوظة" },
  { key: "messages", id: "chat-sessions", label: "جلسات المحادثة" },
  { key: "administration", id: "administration", label: "الإدارة" },
  { key: "users", id: "users", label: "المستخدمون" },
  { key: "roles", id: "roles", label: "الأدوار" },
  { key: "activity-log", id: "activity-log", label: "سجل النشاط" },
  { key: "news", id: "news", label: "الأخبار" },
  { key: "fake-fact", id: "fake-fact", label: "زائف / حقيقة" },
  { key: "circulars", id: "circulars", label: "التعاميم" },
  { key: "marketplace", id: "marketplace", label: "السوق" },
  { key: "jobs", id: "jobs", label: "الوظائف" },
  { key: "ads", id: "ads", label: "الإعلانات" },
  { key: "salary", id: "salary", label: "المعاش" },
  { key: "transactions", id: "transactions", label: "المعاملات" },
  { key: "forms", id: "forms", label: "النماذج" },
  { key: "schools", id: "schools", label: "المدارس" },
  { key: "network", id: "network", label: "الشبكة" },
  { key: "taxi", id: "taxi", label: "تاكسي" },
  { key: "voting", id: "voting", label: "التصويت" },
  { key: "faq", id: "faq", label: "الأسئلة الشائعة" },
  { key: "laws", id: "laws", label: "القوانين" },
  { key: "procedures", id: "procedures", label: "الإجراءات" },
  { key: "world-cup", id: "world-cup", label: "كأس العالم 2026" },
  { key: "community", id: "community", label: "نشاطات المجتمع" },
  { key: "voice", id: "voice", label: "صوت" },
  { key: "deaths", id: "deaths", label: "الوفيات" },
  { key: "health", id: "health", label: "الصحة" },
  { key: "ask-watany", id: "ask-watany", label: "اسأل وطني" }
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\?#].*$/u, "").replace(/[\s_]+/gu, "-").trim();
}
function valueFrom(element: Element, names: string[]): string {
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value) return value;
  }
  return "";
}
function resolveKey(tile: Element): WatanyV4IconName | null {
  const id = normalize(valueFrom(tile,["data-feature-id","data-watany-feature","data-id","data-automation-id"]));
  const title = normalize(valueFrom(tile,["data-feature-title","aria-label","title"]));
  const labelNode = tile.querySelector(".watany-app-icon__label,[data-watany-icon-label],.watany-icon-label,.icon-title");
  const label = normalize(labelNode?.textContent || title || tile.textContent || "");
  for (const mapping of mappings) {
    const expectedId = normalize(mapping.id);
    const expectedLabel = normalize(mapping.label);
    if (id === expectedId || id.endsWith("-" + expectedId)) return mapping.key;
    if (title === expectedLabel || label === expectedLabel) return mapping.key;
  }
  return null;
}
function isHomeRoute(): boolean {
  return ["/","/home","/mobile-os"].includes(window.location.pathname);
}
function visible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}
function patchTile(owner: HTMLElement): boolean {
  if (!visible(owner)) return false;
  const key = resolveKey(owner);
  if (!key) {
    owner.dataset.watanyUniversalIconUnmapped = "true";
    return false;
  }
  const frame = (owner.querySelector(".watany-app-icon__tile,.watany-v4-icon-card,.icon-cadre,[data-watany-icon-card]") || owner) as HTMLElement;
  const glyph = (frame.querySelector(".watany-app-icon__glyph,.watany-approved-runtime-glyph,[data-watany-icon-glyph]") || frame) as HTMLElement;
  let image = glyph.querySelector("img.watany-v4-approved-raster-icon") as HTMLImageElement | null;
  if (!image) {
    image = document.createElement("img");
    image.className = "watany-v4-approved-raster-icon";
    glyph.appendChild(image);
  }
  const labelNode = owner.querySelector(".watany-app-icon__label,[data-watany-icon-label],.watany-icon-label,.icon-title");
  const label = (labelNode?.textContent || owner.getAttribute("aria-label") || key).trim();
  image.src = WATANY_V4_ICONS[key];
  image.alt = label;
  image.decoding = "sync";
  image.loading = "eager";
  image.style.setProperty("width", "100%", "important");
  image.style.setProperty("height", "100%", "important");
  image.style.setProperty("min-width", "100%", "important");
  image.style.setProperty("min-height", "100%", "important");
  image.style.setProperty("max-width", "100%", "important");
  image.style.setProperty("max-height", "100%", "important");
  const frameSize = frame.getBoundingClientRect().width;
  if (frameSize > 0) {
    image.style.setProperty("width", `${frameSize}px`, "important");
    image.style.setProperty("height", `${frameSize}px`, "important");
    image.style.setProperty("min-width", `${frameSize}px`, "important");
    image.style.setProperty("min-height", `${frameSize}px`, "important");
    image.style.setProperty("max-width", `${frameSize}px`, "important");
    image.style.setProperty("max-height", `${frameSize}px`, "important");
  }
  owner.dataset.watanyUniversalFeatureId = key;
  frame.dataset.watanyApprovedRasterTile = "true";
  frame.dataset.watanyApprovedRasterKey = key;
  frame.dataset.watanyApprovedRasterSrc = WATANY_V4_ICONS[key];
  glyph.dataset.watanyApprovedRasterGlyph = "true";
  return true;
}
function candidateOwners(): HTMLElement[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".watany-app-icon,[data-feature-id].feature-icon-item"));
  return Array.from(new Set(nodes));
}
function applyUniversalHomeIcons(): void {
  if (!isHomeRoute()) return;
  const nodes = candidateOwners();
  let patched = 0;
  let unmapped = 0;
  for (const node of nodes) {
    if (patchTile(node)) patched += 1;
    else if (visible(node)) unmapped += 1;
  }
  document.documentElement.dataset.watanyUniversalHomeIconCandidates = String(nodes.length);
  document.documentElement.dataset.watanyUniversalHomeIconPatched = String(patched);
  document.documentElement.dataset.watanyUniversalHomeIconUnmapped = String(unmapped);
}
let observer: MutationObserver | null = null;
export function installWatanyV4ApprovedRasterIconRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const run = () => {
    applyUniversalHomeIcons();
    window.setTimeout(applyUniversalHomeIcons,250);
    window.setTimeout(applyUniversalHomeIcons,900);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",run,{once:true});
  else run();
  if (!observer) {
    observer = new MutationObserver(() => window.requestAnimationFrame(applyUniversalHomeIcons));
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  window.addEventListener("popstate",run);
  window.addEventListener("hashchange",run);
}
installWatanyV4ApprovedRasterIconRuntime();
