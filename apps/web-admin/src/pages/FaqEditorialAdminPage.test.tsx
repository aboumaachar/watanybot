/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FaqEditorialAdminPage from "./FaqEditorialAdminPage";

// Real authority/adminFetch/error handling; only fetch is synthetic.
// No account, gateway, network, or database is used by these tests.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const base = "/api/admin/cms/faqs", authorityPath = "/api/admin-authority/me";
const versionPermission = "cms.version.read", auditPermission = "cms.audit.read";
const roots = new Set<Root>();
const routes = new Map<string, () => Response | Promise<Response>>();
const requests: { path: string; method: string }[] = [];
const unexpected: string[] = [];
const record = (id: string) => ({ id, publicId: id, title: `FAQ ${id}`, status: "DRAFT", version: "1", payload: { answer: `Answer ${id}` }, updatedAt: "now" });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function deferred() {
  let resolve!: (value: Response) => void, reject!: (reason: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function route(path: string, body: unknown, status = 200) { routes.set(path, () => response(body, status)); }
function role(superadmin: boolean, permissions: string[] = []) {
  route(authorityPath, { authority: { actorId: "synthetic-actor", email: "fixture@example.invalid", roles: [superadmin ? "SUPERADMIN" : "ADMIN"], isSuperadmin: superadmin, permissions: ["cms.read", ...permissions] } });
}
function detail(id: string) {
  route(`${base}/${id}`, { item: record(id) });
  route(`${base}/${id}/versions`, { versions: [{ id: `version-${id}`, version: id === "one" ? 1 : 2, createdAt: `version-date-${id}` }] });
  route(`${base}/${id}/audit`, { events: [{ id: `audit-${id}`, eventType: `event-${id}`, actorId: "synthetic-actor", createdAt: `audit-date-${id}` }] });
}
async function flush() { await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }); }
async function mount() {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container); roots.add(root);
  await act(async () => { root.render(<FaqEditorialAdminPage />); }); await flush();
  return { container, root };
}
type View = Awaited<ReturnType<typeof mount>>;
async function choose(view: View, id: string) {
  const controls = view.container.querySelectorAll<HTMLButtonElement>(`button[data-faq-id="${id}"]`);
  expect(controls).toHaveLength(1);
  await act(async () => { controls[0].click(); }); await flush();
}
async function newEntry(view: View) {
  const controls = Array.from(view.container.querySelectorAll("button")).filter((button) => button.textContent === "سؤال جديد");
  expect(controls).toHaveLength(1);
  await act(async () => { controls[0].click(); }); await flush();
}
const answer = (view: View) => view.container.querySelector<HTMLTextAreaElement>('textarea[rows="5"]')!.value;
const history = (view: View, name: string) => view.container.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const requested = (path: string) => requests.filter((item) => item.path === path).length;

beforeEach(() => {
  routes.clear(); requests.length = 0; unexpected.length = 0;
  localStorage.clear(); localStorage.setItem("admin_api_url", "http://faq-fixture.invalid");
  role(false); detail("one"); detail("two");
  route(`${base}?q=&pageSize=100`, { items: [record("one"), record("two")] });
  vi.stubGlobal("fetch", vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    const path = `${url.pathname}${url.search}`, method = (init?.method || "GET").toUpperCase();
    requests.push({ path, method });
    const handler = routes.get(path);
    if (url.origin !== "http://faq-fixture.invalid" || method !== "GET" || !handler) {
      unexpected.push(`${method} ${url.href}`);
      return Promise.reject(new Error("Unexpected fixture request"));
    }
    return Promise.resolve().then(handler);
  }));
});
afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.clear(); document.body.replaceChildren(); localStorage.clear(); vi.unstubAllGlobals();
  expect(unexpected).toEqual([]);
  expect(requests.every((item) => item.method === "GET")).toBe(true);
});

describe("F-01 isolated FAQ DOM and HTTP contracts", () => {
  it("ADMIN reads details, requests no histories, and cannot mutate", async () => {
    const view = await mount(); await choose(view, "one");
    expect(answer(view)).toBe("Answer one"); expect(requested(`${base}/one`)).toBe(1);
    expect(requested(`${base}/one/versions`)).toBe(0); expect(requested(`${base}/one/audit`)).toBe(0);
    expect(view.container.querySelector("details")).toBeNull();
    expect(view.container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
    const writes = Array.from(view.container.querySelectorAll("fieldset button"));
    await act(async () => { writes.forEach((button) => (button as HTMLButtonElement).click()); });
    expect(requests.every((item) => item.method === "GET")).toBe(true);
  });
  it.each([
    ["both", true, true], ["versions only", true, false], ["audit only", false, true], ["neither", false, false],
  ] as const)("SUPERADMIN history capabilities: %s", async (_name, versions, audit) => {
    role(true, [...(versions ? [versionPermission] : []), ...(audit ? [auditPermission] : [])]);
    const view = await mount(); await choose(view, "one");
    expect(answer(view)).toBe("Answer one");
    expect(view.container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(false);
    expect(requested(`${base}/one/versions`)).toBe(versions ? 1 : 0); expect(requested(`${base}/one/audit`)).toBe(audit ? 1 : 0);
    expect(!!history(view, "الإصدارات")).toBe(versions); expect(!!history(view, "التدقيق")).toBe(audit);
    if (versions) expect(history(view, "الإصدارات")!.textContent).toContain("version-date-one");
    if (audit) expect(history(view, "التدقيق")!.textContent).toContain("event-one");
  });
  it.each(["versions", "audit"] as const)("%s synthetic HTTP 403 leaves details and other history visible", async (kind) => {
    role(true, [versionPermission, auditPermission]); route(`${base}/one/${kind}`, { error: "FORBIDDEN" }, 403);
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(history(view, kind === "versions" ? "الإصدارات" : "التدقيق")!.querySelector('[role="alert"]')!.textContent).toContain("ليست لديك صلاحية");
    expect(history(view, kind === "versions" ? "التدقيق" : "الإصدارات")!.textContent).toContain("one");
    expect(view.container.textContent).not.toContain("تعذر قراءة تفاصيل السؤال.");
  });
  it.each(["versions", "audit"] as const)("%s network failure leaves details and other history visible", async (kind) => {
    role(true, [versionPermission, auditPermission]); routes.set(`${base}/one/${kind}`, () => Promise.reject(new TypeError("Synthetic network failure")));
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(history(view, kind === "versions" ? "الإصدارات" : "التدقيق")!.textContent).toContain("تعذر الوصول إلى الخادم");
    expect(history(view, kind === "versions" ? "التدقيق" : "الإصدارات")!.textContent).toContain("one");
  });
  it("both history errors render independently", async () => {
    role(true, [versionPermission, auditPermission]); route(`${base}/one/versions`, { error: "FORBIDDEN" }, 403);
    routes.set(`${base}/one/audit`, () => Promise.reject(new TypeError("Synthetic network failure")));
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(history(view, "الإصدارات")!.querySelector('[role="alert"]')).not.toBeNull();
    expect(history(view, "التدقيق")!.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("slow histories have separate loading states after detail loading finishes", async () => {
    role(true, [versionPermission, auditPermission]); const v = deferred(), a = deferred();
    routes.set(`${base}/one/versions`, () => v.promise); routes.set(`${base}/one/audit`, () => a.promise);
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(view.container.textContent).not.toContain("جارٍ تحميل تفاصيل السؤال");
    expect(history(view, "الإصدارات")!.textContent).toContain("جارٍ تحميل الإصدارات");
    expect(history(view, "التدقيق")!.textContent).toContain("جارٍ تحميل التدقيق");
    expect(history(view, "الإصدارات")!.textContent).not.toContain("لا توجد إصدارات");
    await act(async () => { v.resolve(response({ versions: [] })); }); await flush();
    expect(history(view, "الإصدارات")!.textContent).toContain("لا توجد إصدارات");
    expect(history(view, "التدقيق")!.textContent).toContain("جارٍ تحميل التدقيق");
    await act(async () => { a.resolve(response({ events: [] })); }); await flush();
    expect(history(view, "التدقيق")!.textContent).toContain("لا توجد أحداث تدقيق");
  });
  it("late authority grants load histories for an already selected FAQ", async () => {
    const pending = deferred(); routes.set(authorityPath, () => pending.promise);
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(view.container.querySelector("details")).toBeNull(); expect(requested(`${base}/one/audit`)).toBe(0);
    await act(async () => { pending.resolve(response({ authority: { isSuperadmin: true, permissions: ["cms.read", versionPermission, auditPermission] } })); }); await flush();
    expect(requested(`${base}/one`)).toBe(1); expect(requested(`${base}/one/versions`)).toBe(1); expect(requested(`${base}/one/audit`)).toBe(1);
    expect(history(view, "التدقيق")!.textContent).toContain("event-one");
  });
  it.each(["HTTP", "network"] as const)("failed authority (%s) fails closed without hiding permitted detail", async (failure) => {
    if (failure === "HTTP") route(authorityPath, { error: "FORBIDDEN" }, 403);
    else routes.set(authorityPath, () => Promise.reject(new TypeError("Synthetic network failure")));
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("Answer one");
    expect(view.container.querySelector("details")).toBeNull(); expect(view.container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
    expect(requested(`${base}/one/versions`)).toBe(0); expect(requested(`${base}/one/audit`)).toBe(0);
    expect(view.container.textContent).toContain("تعذّر التحقق من صلاحيات السجل");
  });
  it.each([false, true])("stale detail success and denial cannot replace a later selection (superadmin=%s)", async (superadmin) => {
    role(superadmin, superadmin ? [versionPermission, auditPermission] : []);
    const first = deferred(); routes.set(`${base}/one`, () => first.promise);
    const view = await mount(); await choose(view, "one"); expect(view.container.textContent).toContain("جارٍ تحميل تفاصيل السؤال");
    await choose(view, "two"); await act(async () => { first.resolve(response({ item: record("one") })); }); await flush();
    expect(answer(view)).toBe("Answer two"); expect(requested(`${base}/one/audit`)).toBe(0);
    const denied = deferred(); routes.set(`${base}/one`, () => denied.promise);
    await choose(view, "one"); await choose(view, "two");
    await act(async () => { denied.resolve(response({ error: "FORBIDDEN" }, 403)); }); await flush();
    expect(answer(view)).toBe("Answer two"); expect(view.container.textContent).not.toContain("ليست لديك صلاحية");
  });
  it.each(["success", "failure"] as const)("stale history %s cannot overwrite current histories or errors", async (outcome) => {
    role(true, [versionPermission, auditPermission]); const v = deferred(), a = deferred();
    routes.set(`${base}/one/versions`, () => v.promise); routes.set(`${base}/one/audit`, () => a.promise);
    const view = await mount(); await choose(view, "one"); await choose(view, "two");
    await act(async () => {
      v.resolve(outcome === "success" ? response({ versions: [{ id: "stale-v", version: 99, createdAt: "stale-version" }] }) : response({ error: "FORBIDDEN" }, 403));
      if (outcome === "success") a.resolve(response({ events: [{ id: "stale-a", eventType: "stale-event", createdAt: "stale-date" }] }));
      else a.reject(new TypeError("Synthetic stale network failure"));
    }); await flush();
    expect(answer(view)).toBe("Answer two"); expect(history(view, "التدقيق")!.textContent).toContain("event-two");
    expect(history(view, "الإصدارات")!.textContent).toContain("version-date-two");
    expect(view.container.textContent).not.toMatch(/stale-event|stale-version|ليست لديك صلاحية|تعذر الوصول إلى الخادم/);
  });
  it("detail HTTP denial shows its own error and triggers no histories", async () => {
    role(true, [versionPermission, auditPermission]); route(`${base}/one`, { error: "FORBIDDEN" }, 403);
    const view = await mount(); await choose(view, "one"); expect(answer(view)).toBe("");
    expect(view.container.textContent).toContain("ليست لديك صلاحية"); expect(view.container.querySelector("details")).toBeNull();
    expect(requested(`${base}/one/audit`)).toBe(0); expect(view.container.textContent).not.toContain("جارٍ تحميل تفاصيل السؤال");
  });
  it("new entry cancels a pending detail and permits no stale history requests", async () => {
    role(true, [versionPermission, auditPermission]); const pending = deferred(); routes.set(`${base}/one`, () => pending.promise);
    const view = await mount(); await choose(view, "one"); await newEntry(view);
    await act(async () => { pending.resolve(response({ item: record("one") })); }); await flush();
    expect(answer(view)).toBe(""); expect(view.container.querySelector("details")).toBeNull();
    expect(requested(`${base}/one/versions`)).toBe(0); expect(view.container.textContent).not.toContain("جارٍ تحميل تفاصيل السؤال");
  });
  it("new entry ignores pending history success and denial", async () => {
    role(true, [versionPermission, auditPermission]); const v = deferred(), a = deferred();
    routes.set(`${base}/one/versions`, () => v.promise); routes.set(`${base}/one/audit`, () => a.promise);
    const view = await mount(); await choose(view, "one"); await newEntry(view);
    await act(async () => { v.resolve(response({ versions: [{ id: "old", version: 99, createdAt: "old" }] })); a.resolve(response({ error: "FORBIDDEN" }, 403)); }); await flush();
    expect(answer(view)).toBe(""); expect(view.container.querySelector("details")).toBeNull(); expect(view.container.textContent).not.toContain("ليست لديك صلاحية");
  });
  it.each(["detail", "history"] as const)("unmount invalidates pending %s responses", async (kind) => {
    role(true, [versionPermission, auditPermission]); const pending = deferred();
    routes.set(`${base}/one${kind === "history" ? "/audit" : ""}`, () => pending.promise);
    const view = await mount(); await choose(view, "one"); await act(async () => { view.root.unmount(); }); roots.delete(view.root);
    await act(async () => { pending.resolve(response(kind === "detail" ? { item: record("one") } : { events: [] })); }); await flush();
    expect(view.container.childElementCount).toBe(0); if (kind === "detail") expect(requested(`${base}/one/versions`)).toBe(0);
  });
  it("list loading and empty-list states render correctly", async () => {
    const pending = deferred(); routes.set(`${base}?q=&pageSize=100`, () => pending.promise);
    const view = await mount(); expect(view.container.textContent).toContain("جارٍ التحميل...");
    expect(view.container.querySelectorAll("[data-faq-id]")).toHaveLength(0);
    await act(async () => { pending.resolve(response({ items: [] })); }); await flush();
    expect(view.container.textContent).toContain("لا توجد أسئلة مطابقة.");
    expect(view.container.textContent).not.toContain("جارٍ التحميل..."); expect(answer(view)).toBe("");
  });
  it("empty authorized histories show empty states without errors or spinners", async () => {
    role(true, [versionPermission, auditPermission]); route(`${base}/one/versions`, { versions: [] }); route(`${base}/one/audit`, { events: [] });
    const view = await mount(); await choose(view, "one");
    expect(history(view, "الإصدارات")!.textContent).toContain("لا توجد إصدارات.");
    expect(history(view, "التدقيق")!.textContent).toContain("لا توجد أحداث تدقيق."); expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });
  it("detail-loading disables editing and finishes independently", async () => {
    role(true, [versionPermission, auditPermission]); const pending = deferred(); routes.set(`${base}/one`, () => pending.promise);
    const view = await mount(); await choose(view, "one"); expect(view.container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
    expect(view.container.textContent).toContain("جارٍ تحميل تفاصيل السؤال");
    await act(async () => { pending.resolve(response({ item: record("one") })); }); await flush();
    expect(answer(view)).toBe("Answer one"); expect(view.container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(false);
    expect(view.container.textContent).not.toContain("جارٍ تحميل تفاصيل السؤال");
  });
});
