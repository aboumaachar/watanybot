function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAdminAppUrl(): string | null {
  const baseUrl = trimTrailingSlash(import.meta.env.BASE_URL || "/");
  const internalAdminPath = `${baseUrl === "" ? "" : baseUrl}/superadmin`;

  if (globalThis.window !== undefined) {
    return new URL(internalAdminPath, globalThis.window.location.origin).toString();
  }

  const configuredUrl = import.meta.env.VITE_ADMIN_URL?.trim();
  return configuredUrl || internalAdminPath;
}

export function openAdminApp(): void {
  const adminUrl = getAdminAppUrl();
  if (!adminUrl) {
    throw new Error("لوحة الإدارة غير منشورة على هذا الخادم بعد");
  }

  globalThis.location.assign(adminUrl);
}