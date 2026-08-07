import { useEffect, useState } from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

export type PwaInstallPlatform = "ios" | "android" | "desktop" | "other";

function detectPlatform(userAgent: string): PwaInstallPlatform {
  const normalized = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(normalized)) return "ios";
  if (/android/.test(normalized)) return "android";
  if (/macintosh|windows|linux|cros/.test(normalized)) return "desktop";
  return "other";
}

function detectStandaloneMode() {
  if (typeof window === "undefined") return false;

  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };

  return standaloneMedia || iosNavigator.standalone === true;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => detectStandaloneMode());
  const [platform] = useState<PwaInstallPlatform>(() => {
    if (typeof navigator === "undefined") return "other";
    return detectPlatform(navigator.userAgent);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => {
      setIsStandalone(detectStandaloneMode());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    updateStandalone();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updateStandalone);
    } else {
      media.addListener(updateStandalone);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", updateStandalone);
      } else {
        media.removeListener(updateStandalone);
      }
    };
  }, []);

  const showInstallCta = typeof window !== "undefined" && "serviceWorker" in navigator && !isStandalone;

  async function promptInstall() {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }

    return choice.outcome === "accepted";
  }

  return {
    platform,
    isStandalone,
    showInstallCta,
    canInstall: deferredPrompt !== null,
    promptInstall,
  };
}