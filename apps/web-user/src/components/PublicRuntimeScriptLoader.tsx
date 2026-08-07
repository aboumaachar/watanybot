import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

type RuntimeDefinition = {
  readonly name: string;
  readonly src: string;
  readonly matches: (pathname: string) => boolean;
};

const UNIVERSAL_MENU_PREVIEW_ENABLED = ((import.meta.env.VITE_WATANY_UNIVERSAL_MENU_PREVIEW ?? "false").toLowerCase() === "true");
const LEGACY_RUNTIME_PATCHES_ENABLED = ((import.meta.env.VITE_WATANY_LEGACY_RUNTIME_PATCHES ?? (UNIVERSAL_MENU_PREVIEW_ENABLED ? "false" : "true")).toLowerCase() === "true");

const ROUTE_SCOPED_RUNTIMES: RuntimeDefinition[] = [
  {
    name: "watany-v1-tools-schools-public-access-v144",
    src: "/watany-v1-tools-schools-public-access-v144.js",
    matches: (pathname) => pathname.startsWith("/school-grants") || pathname.startsWith("/admin"),
  },
  {
    name: "watany-v1-jobs-market-public-access-v150",
    src: "/watany-v1-jobs-market-public-access-v150.js",
    matches: (pathname) => pathname.startsWith("/jobs") || pathname.startsWith("/market") || pathname.startsWith("/marketplace") || pathname.startsWith("/recruitment"),
  },
  {
    name: "watany-v1-going-now-feed-v160",
    src: "/watany-v1-going-now-feed-v160.js",
    matches: (pathname) => pathname.startsWith("/updates") || pathname.startsWith("/news") || pathname.startsWith("/alerts") || pathname.startsWith("/announcements"),
  },
  {
    name: "watany-v1-clean-settings-single-template-v190",
    src: "/watany-v1-clean-settings-single-template-v190.js",
    matches: (pathname) => pathname.startsWith("/settings"),
  },
];

const loadedRuntimeNames = new Set<string>();

function resolveRuntimeUrl(src: string): string {
  return new URL(src.replace(/^\//, ""), `${globalThis.location.origin}${import.meta.env.BASE_URL}`).toString();
}

function ensureRuntimeScript(runtime: RuntimeDefinition): void {
  if (loadedRuntimeNames.has(runtime.name)) {
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[data-watany-runtime-loader="${runtime.name}"]`);
  if (existing) {
    loadedRuntimeNames.add(runtime.name);
    return;
  }

  const script = document.createElement("script");
  script.defer = true;
  script.src = resolveRuntimeUrl(runtime.src);
  script.dataset.watanyRuntimeLoader = runtime.name;
  script.dataset.watanyRuntimeManaged = "true";
  script.addEventListener("load", () => {
    loadedRuntimeNames.add(runtime.name);
  }, { once: true });
  document.head.appendChild(script);
}

export default function PublicRuntimeScriptLoader() {
  const location = useLocation();

  const activeRuntimes = useMemo(() => {
    if (!LEGACY_RUNTIME_PATCHES_ENABLED) {
      return [];
    }
    return ROUTE_SCOPED_RUNTIMES.filter((runtime) => runtime.matches(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    activeRuntimes.forEach((runtime) => {
      ensureRuntimeScript(runtime);
    });
  }, [activeRuntimes]);

  return null;
}