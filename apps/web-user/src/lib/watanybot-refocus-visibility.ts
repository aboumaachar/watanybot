export const WATANYBOT_SCHOOL_AID_LABEL = "المساعدات المدرسية";

export const WATANYBOT_DISABLED_PUBLIC_SERVICE_FALLBACK = "هذه الخدمة غير مفعّلة حالياً";

const WATANYBOT_DISABLED_PUBLIC_SERVICE_ALIASES = [
] as const;

const WATANYBOT_DISABLED_PUBLIC_TILE_IDS = new Set([
  "payments",
  "allowances",
  "loans",
  "entitlements",
  "documents",
  "tracking",
  "mil-med",
  "affidavit",
  "mine",
  "upload",
  "consult",
]);

export const WATANYBOT_DISABLED_PUBLIC_SERVICES = [
  "طلب إفادة راتب"
] as const;

export function isWatanyBotPublicServiceDisabled(label: string): boolean {
  return [...WATANYBOT_DISABLED_PUBLIC_SERVICES, ...WATANYBOT_DISABLED_PUBLIC_SERVICE_ALIASES].some((item) =>
    label.includes(item),
  );
}

export function isWatanyBotPublicTileDisabled(tile: { id?: string; label: string; shortLabel?: string }): boolean {
  if (tile.id && WATANYBOT_DISABLED_PUBLIC_TILE_IDS.has(tile.id)) {
    return true;
  }

  return [tile.label, tile.shortLabel ?? ""].some((item) => item && isWatanyBotPublicServiceDisabled(item));
}