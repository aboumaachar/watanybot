/* eslint-disable react-hooks/exhaustive-deps -- APEX scoped legacy lint closeout: pre-existing preview viewer hook warning; outside compact procedures viewer patch */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ProcedurePreviewViewerItem = Readonly<{
  id: string;
  title: string;
  summary?: string;
  previewUrl?: string;   // optional — viewer shows fallback card when absent
  downloadUrl?: string;
}>;

type ViewerSizeMode = "compact" | "wide" | "full";
type ViewerFitMode = "manual" | "width" | "page";

type Props = Readonly<{
  items: ProcedurePreviewViewerItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onShare: (id: string) => void;
  onDownload: (id: string) => void;
  shareMessage: string;
}>;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const FRAME_BASE_WIDTH = 1120;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))));
}

function getFrameHeight(): number {
  return 1120;
}

function getFitModeLabel(fitMode: ViewerFitMode): string {
  switch (fitMode) {
    case "width":
      return "ملاءمة العرض";
    case "page":
      return "ملاءمة الصفحة";
    default:
      return "تكبير يدوي";
  }
}

export function ProcedurePreviewViewer({ items, activeId, onSelect, onClose, onShare, onDownload, shareMessage }: Props) {
  const activeItem = items.find((item) => item.id === activeId) || items[0];
  const [zoom, setZoom] = useState(1);
  const [sizeMode, setSizeMode] = useState<ViewerSizeMode>("full");
  const [fitMode, setFitMode] = useState<ViewerFitMode>("page");
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [frameError, setFrameError] = useState(() => !activeItem?.previewUrl);
  const frameWrapRef = useRef<HTMLDivElement | null>(null);
  // Timeout-based fallback: if iframe hasn't loaded within 3 s, show fallback card
  const frameLoadedRef = useRef(false);
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeItem) {
      setFrameError(true);
      return;
    }

    setZoom(1);
    setFitMode("page");
    frameLoadedRef.current = false;
    if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);

    const hasUrl = Boolean(activeItem.previewUrl);
    setFrameError(!hasUrl);

    if (hasUrl) {
      // If iframe doesn't fire onLoad within 3 s, assume blocked/broken → fallback
      frameTimeoutRef.current = setTimeout(() => {
        if (!frameLoadedRef.current) setFrameError(true);
      }, 3000);
    }

    return () => {
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
    };
  }, [activeId, activeItem?.previewUrl]);

  useEffect(() => {
    const node = frameWrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setViewportSize({
        width: Math.max(0, node.clientWidth),
        height: Math.max(0, node.clientHeight),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = frameWrapRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      setFitMode("manual");
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };

    node.addEventListener("wheel", handleWheel, { passive: false });

    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!activeItem) return;

    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentIndex = items.findIndex((item) => item.id === activeItem.id);
      const isRtl = typeof document !== "undefined" && getComputedStyle(document.documentElement).direction === "rtl";
      const nextKey = isRtl ? "ArrowLeft" : "ArrowRight";
      const previousKey = isRtl ? "ArrowRight" : "ArrowLeft";

      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === nextKey && currentIndex < items.length - 1) {
        onSelect(items[currentIndex + 1].id);
        return;
      }

      if (event.key === previousKey && currentIndex > 0) {
        onSelect(items[currentIndex - 1].id);
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setFitMode("manual");
        setZoom((current) => clampZoom(current + ZOOM_STEP));
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        setFitMode("manual");
        setZoom((current) => clampZoom(current - ZOOM_STEP));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setFitMode("manual");
        setZoom(1);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItem, items, onClose, onSelect]);

  const activeIndex = items.findIndex((item) => item.id === activeItem?.id);

  const frameMetrics = useMemo(() => {
    const frameHeight = getFrameHeight();
    const widthZoom = viewportSize.width > 0 ? viewportSize.width / FRAME_BASE_WIDTH : 1;
    const pageZoom = viewportSize.width > 0 && viewportSize.height > 0
      ? Math.min(viewportSize.width / FRAME_BASE_WIDTH, viewportSize.height / frameHeight)
      : 1;
    let resolvedZoom = clampZoom(zoom);

    if (fitMode === "width") {
      resolvedZoom = clampZoom(widthZoom);
    } else if (fitMode === "page") {
      resolvedZoom = clampZoom(pageZoom);
    }

    const canvasWidth = Math.max(FRAME_BASE_WIDTH * resolvedZoom, viewportSize.width || 0);
    const canvasHeight = Math.max(frameHeight * resolvedZoom, viewportSize.height || 0);

    return {
      frameHeight,
      resolvedZoom,
      canvasWidth: `${canvasWidth}px`,
      canvasHeight: `${canvasHeight}px`,
      frameWidth: `${FRAME_BASE_WIDTH}px`,
      frameScaledHeight: `${frameHeight}px`,
      frameTransform: `scale(${resolvedZoom})`,
    };
  }, [fitMode, viewportSize.height, viewportSize.width, zoom]);

  if (!activeItem || typeof document === "undefined") return null;

  return createPortal(
    <dialog className="proc-viewer" open aria-modal="true" aria-label={activeItem.title}>
      <button className="proc-viewer__backdrop" type="button" aria-label="إغلاق المعاينة" onClick={onClose} />
      <div className="proc-viewer__panel proc-viewer__panel--full">
        <div className="proc-viewer__header">
          <div className="proc-viewer__heading">
            <div className="proc-viewer__title">{activeItem.title}</div>
            {activeItem.summary && <div className="proc-viewer__summary">{activeItem.summary}</div>}
            <div className="proc-viewer__count">
              المستند {activeIndex + 1} من {items.length} · التكبير {Math.round(frameMetrics.resolvedZoom * 100)}% · {getFitModeLabel(fitMode)}
            </div>
          </div>

          <div className="proc-viewer__toolbar">
            <div className="proc-viewer__toolbar-group proc-viewer__toolbar-group--nav">
              <button className="proc-viewer__btn" type="button" onClick={() => onSelect(items[activeIndex - 1].id)} disabled={activeIndex <= 0}>
                السابق
              </button>
              <button className="proc-viewer__btn" type="button" onClick={() => onSelect(items[activeIndex + 1].id)} disabled={activeIndex >= items.length - 1}>
                التالي
              </button>
            </div>

            <div className="proc-viewer__toolbar-group proc-viewer__toolbar-group--zoom">
              <button className="proc-viewer__btn proc-viewer__btn--icon" type="button" aria-label="تصغير" title="تصغير" onClick={() => {
                setFitMode("manual");
                setZoom((current) => clampZoom(current - ZOOM_STEP));
              }} disabled={frameMetrics.resolvedZoom <= ZOOM_MIN}>
                −
              </button>
              <button className="proc-viewer__btn proc-viewer__btn--metric" type="button" onClick={() => {
                setFitMode("manual");
                setZoom(1);
              }}>
                {Math.round(frameMetrics.resolvedZoom * 100)}%
              </button>
              <button className="proc-viewer__btn proc-viewer__btn--icon" type="button" aria-label="تكبير" title="تكبير" onClick={() => {
                setFitMode("manual");
                setZoom((current) => clampZoom(current + ZOOM_STEP));
              }} disabled={frameMetrics.resolvedZoom >= ZOOM_MAX}>
                +
              </button>
              <button className={`proc-viewer__btn${fitMode === "width" ? " proc-viewer__btn--active" : ""}`} type="button" onClick={() => setFitMode("width")}>
                <span className="proc-viewer__btn-label">ملاءمة العرض</span>
              </button>
              <button className={`proc-viewer__btn${fitMode === "page" ? " proc-viewer__btn--active" : ""}`} type="button" onClick={() => setFitMode("page")}>
                <span className="proc-viewer__btn-label">ملاءمة الصفحة</span>
              </button>
            </div>

            <div className="proc-viewer__toolbar-group proc-viewer__toolbar-group--size">
              <button className={`proc-viewer__btn${sizeMode === "compact" ? " proc-viewer__btn--active" : ""}`} type="button" onClick={() => setSizeMode("compact")}>
                مدمج
              </button>
              <button className={`proc-viewer__btn${sizeMode === "wide" ? " proc-viewer__btn--active" : ""}`} type="button" onClick={() => setSizeMode("wide")}>
                واسع
              </button>
              <button className={`proc-viewer__btn${sizeMode === "full" ? " proc-viewer__btn--active" : ""}`} type="button" onClick={() => setSizeMode("full")}>
                كامل
              </button>
            </div>

            <div className="proc-viewer__toolbar-group proc-viewer__toolbar-group--actions">
              {activeItem.downloadUrl ? (
                <button className="proc-viewer__btn proc-viewer__btn--primary" type="button" onClick={() => onDownload(activeItem.id)}>
                  تحميل
                </button>
              ) : null}
              <button className="proc-viewer__btn" type="button" onClick={() => onShare(activeItem.id)}>
                مشاركة
              </button>
              <button className="proc-viewer__btn" type="button" onClick={onClose}>
                إغلاق
              </button>
            </div>
          </div>
        </div>

        {items.length > 1 && (
          <div className="proc-viewer__doc-rail" role="tablist" aria-label="التنقل بين المستندات المفتوحة">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === activeItem.id}
                className={`proc-viewer__doc-pill${item.id === activeItem.id ? " proc-viewer__doc-pill--active" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="proc-viewer__doc-pill-index">{index + 1}</span>
                <span className="proc-viewer__doc-pill-title">{item.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="proc-viewer__frame-wrap" ref={frameWrapRef}>
          {frameError ? (
            <div className="proc-viewer__fallback">
              <div className="proc-viewer__fallback-icon">
                <i className="ph ph-file-x" aria-hidden="true" />
              </div>
              <p className="proc-viewer__fallback-title">لا تتوفر معاينة PDF لهذا النموذج حالياً.</p>
              <p className="proc-viewer__fallback-sub">يمكنك عرض بيانات النموذج أو تحميل/طباعة النسخة المتاحة.</p>
              {activeItem.downloadUrl && (
                <button
                  type="button"
                  className="proc-doc__btn proc-doc__btn--primary"
                  onClick={() => onDownload(activeItem.id)}
                >
                  تحميل النموذج
                </button>
              )}
            </div>
          ) : (
          <div className="proc-viewer__canvas" style={{ width: frameMetrics.canvasWidth, height: frameMetrics.canvasHeight }}>
            <iframe
              key={`${activeItem.id}-${activeItem.previewUrl || "no-preview"}`}
              className="proc-viewer__frame"
              src={activeItem.previewUrl ?? "about:blank"}
              title={activeItem.title}
              style={{
                width: frameMetrics.frameWidth,
                height: frameMetrics.frameScaledHeight,
                transform: frameMetrics.frameTransform,
                transformOrigin: "top center",
              }}
              onLoad={() => {
                frameLoadedRef.current = true;
                if (frameTimeoutRef.current) {
                  clearTimeout(frameTimeoutRef.current);
                  frameTimeoutRef.current = null;
                }
                setFrameError(false);
              }}
              onError={() => setFrameError(true)}
            />
          </div>
          )}
        </div>

        {shareMessage && <div className="proc-viewer__status">{shareMessage}</div>}
      </div>
    </dialog>,
    document.body,
  );
}
