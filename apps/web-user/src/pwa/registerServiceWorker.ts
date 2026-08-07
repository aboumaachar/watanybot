async function cleanupDevelopmentServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("WatanyBot dev service worker cleanup failed", error);
  }

  if (!("caches" in globalThis)) return;

  try {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  } catch (error) {
    console.warn("WatanyBot dev cache cleanup failed", error);
  }
}

const DEV_SW_RESET_FLAG = "watany_dev_sw_reset_done";

function hasCompletedDevelopmentServiceWorkerReset() {
  try {
    return localStorage.getItem(DEV_SW_RESET_FLAG) === "1";
  } catch {
    return sessionStorage.getItem(DEV_SW_RESET_FLAG) === "1";
  }
}

function markDevelopmentServiceWorkerReset() {
  try {
    localStorage.setItem(DEV_SW_RESET_FLAG, "1");
    return;
  } catch {
    // Fall back to sessionStorage when localStorage is unavailable.
  }

  sessionStorage.setItem(DEV_SW_RESET_FLAG, "1");
}

async function resetDevelopmentServiceWorkerControl() {
  if (!("serviceWorker" in navigator)) return true;

  if (hasCompletedDevelopmentServiceWorkerReset()) {
    return true;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  await cleanupDevelopmentServiceWorkers();

  markDevelopmentServiceWorkerReset();

  if (!hadController) return true;
  globalThis.window.location.reload();
  return false;
}

export function registerWatanyServiceWorker() {
  if (globalThis.window === undefined || !("serviceWorker" in navigator)) return;

  const currentWindow = globalThis.window;

  if (import.meta.env.DEV) {
    void resetDevelopmentServiceWorkerControl();
    return;
  }

  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  }).catch((error) => {
    console.warn("WatanyBot service worker cleanup failed", error);
  });

  void currentWindow.caches?.keys().then((keys) => Promise.all(keys.map((key) => currentWindow.caches.delete(key)))).catch(() => {
    // Cache cleanup is best-effort only.
  });
}
