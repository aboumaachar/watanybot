import { useEffect } from "react";
import "../styles/watanyForceCloneHost.css";

/**
 * Force-fixed approved Watany homepage.
 *
 * This component must stay simple:
 * - one iframe only
 * - no WR shell
 * - no wr-dock
 * - no generated icon CSS
 * - no route hook required for the iframe to appear
 */
export default function WatanyForceCloneHome() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; route?: string } | null;
      if (!data || data.type !== "WATANY_APPROVED_HOME_ROUTE" || !data.route) {
        return;
      }
      window.history.pushState({}, "", data.route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main className="watany-force-clone-host" data-apex-authority="approved-home-iframe-force-fix">
      <iframe
        className="watany-force-clone-frame"
        title="Watany approved homepage"
        src="/watany-approved-force-clone.html"
      />
    </main>
  );
}
