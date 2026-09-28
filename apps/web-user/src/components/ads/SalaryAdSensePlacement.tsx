import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-6562406855952870";
const ADSENSE_DEFAULT_SLOT = "9426086926";
const ADSENSE_BOTTOM_SLOT = "5372868255";
const ADSENSE_SCRIPT_ID = "watany-adsense-script";
const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const MOBILE_AD_QUERY = "(max-width: 640px)";

const containerStyle = { margin: "0 0 16px", padding: "0 2px" } as const;
const labelStyle = { margin: "0 4px 6px", color: "#88948f", fontSize: "10px", lineHeight: 1.4 } as const;
const desktopFrameStyle = { minHeight: "100px", overflow: "hidden", borderRadius: "14px", background: "rgba(255,255,255,0.018)" } as const;
function mobileFrameStyle(width: number) {
  return {
    width: "100%",
    maxWidth: `${width}px`,
    height: "100px",
    margin: "0 auto",
    overflow: "hidden",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.018)",
  } as const;
}

function salaryAdSlot(placement: "primary" | "results") {
  const configured = placement === "results"
    ? String(import.meta.env.VITE_ADSENSE_SALARY_RESULTS_SLOT_ID ?? "").trim()
    : String(import.meta.env.VITE_ADSENSE_SALARY_SLOT_ID ?? "").trim();
  if (/^\d+$/.test(configured)) return configured;
  return placement === "results" ? ADSENSE_BOTTOM_SLOT : ADSENSE_DEFAULT_SLOT;
}

function featureKeyForPlacement(placement: "primary" | "results") {
  return placement === "results" ? "feature.adsense.salary.bottom" : "feature.adsense.salary.inline";
}
function ensureAdSenseScript() {
  const existing = document.getElementById(ADSENSE_SCRIPT_ID)
    ?? document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`);
  if (existing) return;
  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.src = ADSENSE_SCRIPT_SRC;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function SalaryAdSensePlacement({ placement = "primary" }: { placement?: "primary" | "results" }) {
  const slot = salaryAdSlot(placement);
  const requestedRef = useRef(false);
  const adElementRef = useRef<HTMLModElement | null>(null);
  const isResults = placement === "results";
  const isMobile = typeof window !== "undefined" && window.matchMedia(MOBILE_AD_QUERY).matches;
  const isNarrowMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 375px)").matches;
  const mobileAdWidth = isNarrowMobile ? 300 : 320;

  useEffect(() => {
    if (!slot) return;
    const requestAd = () => {
      if (requestedRef.current) return;
      const adElement = adElementRef.current;
      if (!adElement || !document.documentElement.contains(adElement)) return;
      requestedRef.current = true;
      ensureAdSenseScript();
      try {
        const queue = window.adsbygoogle ?? [];
        window.adsbygoogle = queue;
        queue.push({});
      } catch {
        requestedRef.current = false;
      }
    };
    const timer = window.setTimeout(requestAd, isResults ? 1200 : 2200);
    return () => window.clearTimeout(timer);
  }, [slot, placement]);

  if (!slot) return null;

  const useResponsive = !isMobile;
  const adProps = useResponsive
    ? { "data-ad-format": "auto", "data-full-width-responsive": "true" }
    : {};

  return (
    <aside
      data-feature-key={featureKeyForPlacement(placement)}
      data-watany-ad-placement={placement === "results" ? "bottom" : "inline"}
      data-adsense-status="configured"
      data-ad-slot={slot}
      aria-label="إعلان"
      style={containerStyle}
    >
      <div style={labelStyle}>إعلان</div>
      <div style={useResponsive ? desktopFrameStyle : mobileFrameStyle(mobileAdWidth)}>
        <ins
          ref={adElementRef}
          className="adsbygoogle"
          style={useResponsive
            ? { display: "block", width: "100%" }
            : { display: "inline-block", width: `${mobileAdWidth}px`, height: "100px" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          {...adProps}
        />
      </div>
    </aside>
  );
}
