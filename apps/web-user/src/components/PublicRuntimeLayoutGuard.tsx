import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  cleanupRouteActivationChrome,
  clearRouteActivationOptIn,
  shouldAllowRouteActivationOptIn,
} from "../lib/publicRuntimeChrome";

export default function PublicRuntimeLayoutGuard() {
  const location = useLocation();

  useEffect(() => {
    const allowSupplementalChrome = shouldAllowRouteActivationOptIn(location.pathname);

    if (!allowSupplementalChrome) {
      clearRouteActivationOptIn();
      cleanupRouteActivationChrome();
    }

    let frameId = 0;
    const scheduleCleanup = () => {
      if (allowSupplementalChrome || frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        cleanupRouteActivationChrome();
      });
    };

    const observer = new MutationObserver(() => {
      scheduleCleanup();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [location.pathname]);

  return null;
}