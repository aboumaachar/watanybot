import { createElement, isValidElement, useEffect, useRef, type ComponentType, type ReactNode, type SVGProps, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { Dismiss24Regular } from "../theme/watany-v4/legacyIconBridge";
import { IconShell } from "./IconShell";

type Props = Readonly<{
  open: boolean;
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  /** Optional icon content for premium header */
  icon?: ReactNode | ComponentType<SVGProps<SVGSVGElement>>;
  /** Visual variant - premium adds gradient header + enhanced styling */
  variant?: "default" | "premium";
  /** Optional footer slot for action buttons */
  footer?: ReactNode;
  /** Hide the header row and keep a floating close action */
  hideHeader?: boolean;
  /** On mobile, snap the popup directly under the live sticky header */
  mobileStickyAnchor?: boolean;
  /** Compress mobile spacing for dense, scrollable popup cards */
  compactMobile?: boolean;
}>;

function isComponentType(v: unknown): v is ComponentType<SVGProps<SVGSVGElement>> {
  return typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in v);
}

function renderIconProp(icon: ReactNode | ComponentType<SVGProps<SVGSVGElement>>) {
  if (isComponentType(icon)) {
    return createElement(icon, { "aria-hidden": true });
  }
  return icon;
}

/**
 * v6 - Popup modal with premium variant:
 * - Bottom-sheet on mobile, centered on desktop
 * - Premium variant: gradient cedar-green header with icon
 * - Optional footer slot for primary/secondary actions
 * - On close, returns focus to chat composer via a global event
 */
export function PopupModal({
  open,
  title,
  onClose,
  children,
  icon,
  variant = "default",
  footer,
  hideHeader = false,
  mobileStickyAnchor = false,
  compactMobile = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const isPremium = variant === "premium";
  const shouldShowHeader = !hideHeader;

  function close() {
    if (typeof onClose === "function") {
      onClose?.();
    }
    // Return focus to chat
    globalThis.dispatchEvent(new Event("watany-focus-chat"));
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    const end = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (start !== null && end !== null && end - start > 72) {
      close();
    }
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (typeof onClose === "function") {
          onClose?.();
        }
        globalThis.dispatchEvent(new Event("watany-focus-chat"));
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !mobileStickyAnchor) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const clearAnchor = () => {
      dialog.style.removeProperty("top");
      dialog.style.removeProperty("height");
      dialog.style.removeProperty("max-height");
      dialog.style.removeProperty("--watany-popup-sticky-top");
    };

    const applyAnchor = () => {
      if (globalThis.innerWidth > 768) {
        clearAnchor();
        return;
      }

      const header = document.querySelector<HTMLElement>(
        ".watany-mobile-shell__topbar, [aria-label='الشريط العلوي'], header, [class*='TopBar'], [class*='topbar'], [class*='top-bar'], [class*='top-menu']"
      );

      const headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 0;
      if (headerBottom <= 0) {
        clearAnchor();
        return;
      }

      const topValue = `${headerBottom}px`;
      const heightValue = `calc(100dvh - ${headerBottom}px)`;

      dialog.style.setProperty("--watany-popup-sticky-top", topValue);
      dialog.style.setProperty("top", topValue, "important");
      dialog.style.setProperty("height", heightValue, "important");
      dialog.style.setProperty("max-height", heightValue, "important");
    };

    const frame = globalThis.requestAnimationFrame(applyAnchor);
    globalThis.addEventListener("resize", applyAnchor, { passive: true });
    globalThis.addEventListener("orientationchange", applyAnchor, { passive: true });

    return () => {
      globalThis.cancelAnimationFrame(frame);
      globalThis.removeEventListener("resize", applyAnchor);
      globalThis.removeEventListener("orientationchange", applyAnchor);
      clearAnchor();
    };
  }, [mobileStickyAnchor, open]);

  if (!open) return null;

  const sheetClass = `popup-sheet${isPremium ? " popup-premium" : ""}${compactMobile ? " popup-sheet--compact-mobile" : ""}`;
  const isSchoolGrantsCalculator = title === "حاسبة تعرفة تعاونية موظفي الدولة";
  const isSalaryPopup = ["نتيجة الاحتساب", "اختر الرتبة", "اختر الدرجة", "الوضع العائلي", "عدد الأولاد على العاتق", "اختر الوسام"].includes(title ?? "");

  const dialog = (
    <dialog
      open
      className="popup-overlay"
      ref={dialogRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={sheetClass} ref={ref} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {shouldShowHeader ? <div className="popup-handle" /> : null}
        {shouldShowHeader ? (
          <div className={`popup-header${isPremium ? " popup-header--premium" : ""}`}>
            {isPremium && icon && (
              <IconShell className="popup-header__icon" aria-hidden="true">
                {isValidElement(icon)
                  ? icon
                  : renderIconProp(icon)}
              </IconShell>
            )}
            <span className="popup-title">{title}</span>
            <button className="popup-cancel wt-cta-glow" type="button" onClick={close} aria-label="إلغاء" title="إلغاء">
              {isPremium && !isSchoolGrantsCalculator && !isSalaryPopup ? <Dismiss24Regular aria-hidden /> : "إلغاء"}
            </button>
          </div>
        ) : (
          <button className="popup-cancel popup-cancel--detached wt-cta-glow" type="button" onClick={close} aria-label="إغلاق" title="إغلاق">
            {isSalaryPopup ? "إغلاق" : <Dismiss24Regular aria-hidden />}
          </button>
        )}
        <div className="popup-body">{children}</div>
        {footer && <div className="popup-footer">{footer}</div>}
      </div>
    </dialog>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}



