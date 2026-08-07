import { installWatanyPreLandingDeferredNavigationRuntime } from "./features/guided-help/watanyPreLandingDeferredNavigationRuntime";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./store/app-provider";
import { FeatureFlagsProvider } from "./store/features-provider";
import "./theme/watany-v4/index.css";

function clearStaleFirstPaintGuards(): void {
  const root = document.documentElement;
  const classesToClear = [
    "watany-v1-first-paint-stabilizing",
    "watany-no-theme-transitions",
  ];

  for (const className of classesToClear) {
    root.classList.remove(className);
  }

  root.setAttribute("data-watany-v1-first-paint-ready", "app-hydrated");
}

function retireStaleRuntime(): void {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) void registration.unregister();
    }).catch(() => {});
  }
  if ("caches" in globalThis) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }
}

retireStaleRuntime();
document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";
document.body.dataset.watanyRuntime = "watany-v4-react";

const root = document.getElementById("root");
if (!root) throw new Error("WATANY_ROOT_ELEMENT_MISSING");

installWatanyPreLandingDeferredNavigationRuntime();
clearStaleFirstPaintGuards();
globalThis.requestAnimationFrame(clearStaleFirstPaintGuards);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <FeatureFlagsProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </FeatureFlagsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
