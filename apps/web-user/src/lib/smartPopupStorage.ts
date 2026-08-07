export type SmartPopupAction = "seen" | "applied" | "canceled";

export type SmartPopupStoredAction = {
  campaignId: string;
  action: SmartPopupAction;
  actionAt: string;
};

const STORAGE_KEY = "watany.smartPopup.actions.v1";

function readAll(): Record<string, SmartPopupStoredAction> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, SmartPopupStoredAction>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage can fail in private mode. Ignore safely.
  }
}

export function getSmartPopupAction(campaignId: string): SmartPopupStoredAction | null {
  const all = readAll();
  return all[campaignId] ?? null;
}

export function rememberSmartPopupAction(campaignId: string, action: SmartPopupAction) {
  const all = readAll();
  all[campaignId] = { campaignId, action, actionAt: new Date().toISOString() };
  writeAll(all);
}

export function shouldShowSmartPopupCampaign(args: {
  campaignId: string;
  stopAfterApplied: boolean;
  repeatIfCanceled: boolean;
  cooldownDaysIfCanceled: number;
}) {
  const last = getSmartPopupAction(args.campaignId);
  if (!last) return true;
  if (last.action === "applied" && args.stopAfterApplied) return false;
  if (last.action === "canceled") {
    if (!args.repeatIfCanceled) return false;
    if (args.cooldownDaysIfCanceled <= 0) return true;
    const lastTime = Date.parse(last.actionAt);
    if (Number.isNaN(lastTime)) return true;
    return Date.now() - lastTime >= args.cooldownDaysIfCanceled * 24 * 60 * 60 * 1000;
  }
  return true;
}