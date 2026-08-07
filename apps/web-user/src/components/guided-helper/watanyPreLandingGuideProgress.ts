type WatanyPreLandingProgress = { completed?: boolean; doNotShow?: boolean; remindUntil?: number; seenCount?: number; updatedAt?: string };
const PREFIX = 'watany:prelanding-guide:v1';
function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }
function scope(): string { const s = storage(); if (!s) return 'anonymous'; for (const k of ['watany:user:id','watany.currentUserId','watany.profile.id','userId']) { const v = s.getItem(k); if (v?.trim()) return v.trim().slice(0, 80); } return 'anonymous'; }
function part(value: string): string { return encodeURIComponent(value || 'unknown').replace(/%/g, '_'); }
function key(guideKey: string, route: string): string { return `${PREFIX}:${part(scope())}:${part(guideKey)}:${part(route)}`; }
function read(guideKey: string, route: string): WatanyPreLandingProgress { const s = storage(); if (!s) return {}; const raw = s.getItem(key(guideKey, route)); if (!raw) return {}; try { const parsed = JSON.parse(raw) as WatanyPreLandingProgress; return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; } }
function write(guideKey: string, route: string, next: WatanyPreLandingProgress): void { const s = storage(); if (!s) return; s.setItem(key(guideKey, route), JSON.stringify({ ...next, updatedAt: new Date().toISOString() })); }
export function shouldShowWatanyPreLandingGuide(guideKey: string, route: string, now = Date.now()): boolean { const p = read(guideKey, route); if (p.completed || p.doNotShow) return false; if (typeof p.remindUntil === 'number' && p.remindUntil > now) return false; return true; }
export function markWatanyPreLandingSeen(guideKey: string, route: string): void { const p = read(guideKey, route); write(guideKey, route, { ...p, seenCount: (p.seenCount || 0) + 1 }); }
export function markWatanyPreLandingCompleted(guideKey: string, route: string): void { write(guideKey, route, { ...read(guideKey, route), completed: true, remindUntil: undefined }); }
export function markWatanyPreLandingDoNotShow(guideKey: string, route: string): void { write(guideKey, route, { ...read(guideKey, route), doNotShow: true, remindUntil: undefined }); }
export function markWatanyPreLandingRemindLater(guideKey: string, route: string, hours: number): void { write(guideKey, route, { ...read(guideKey, route), remindUntil: Date.now() + Math.max(1, hours) * 60 * 60 * 1000 }); }
export function clearWatanyPreLandingProgressForRoute(guideKey: string, route: string): void { const s = storage(); if (s) s.removeItem(key(guideKey, route)); }