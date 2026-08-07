import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarInput } from "./aided-input";
import type { FormGovernance } from "../lib/api";
import type { FormTemplate, FormField } from "../types/domain";

const printableHtmlSanitizerOptions = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea", "select"],
  ALLOW_DATA_ATTR: false,
};

function sanitizePrintableHtml(html: string): string {
  return DOMPurify.sanitize(html, printableHtmlSanitizerOptions);
}

function getGovernanceStateLabel(governance?: FormGovernance): string | null {
  if (!governance) return null;
  return governance.governanceState === "official_reference" ? "مرجع رسمي" : "موثق رسمياً";
}

type GovernedFormTemplate = FormTemplate & {
  governance?: FormGovernance;
  sourceName?: string;
};

/* ------------------------------------------------------------------ */
/*  Individual field renderer                                          */
/* ------------------------------------------------------------------ */

function FormFieldInput({
  field,
  value,
  onChange,
  printMode,
}: {
  field: FormField;
  value: string;
  onChange: (val: string) => void;
  printMode: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: printMode ? "4px 0" : "10px 12px",
    border: printMode ? "none" : "1px solid var(--border, #d1d5db)",
    borderBottom: printMode ? "1px solid #999" : undefined,
    borderRadius: printMode ? 0 : "6px",
    fontSize: printMode ? "13px" : "14px",
    fontFamily: "inherit",
    background: printMode ? "transparent" : "var(--bg, #fff)",
    color: "var(--ink, #1a1a1a)",
    direction: "rtl",
  };

  if (printMode && !value) {
    // In print mode, show underlined blank space for empty fields
    return (
      <div style={{ ...baseStyle, minHeight: field.type === "textarea" ? "60px" : "24px", borderBottom: "1px dotted #999" }}>
        &nbsp;
      </div>
    );
  }

  switch (field.type) {
    case "select":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={baseStyle}
          required={field.required}
        >
          <option value="">{field.placeholder || "— اختر —"}</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "textarea":
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={printMode ? 4 : 3}
          placeholder={field.placeholder}
          style={{ ...baseStyle, resize: "vertical", minHeight: printMode ? "60px" : "80px" }}
          required={field.required}
        />
      );

    case "checkbox":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            style={{ width: "18px", height: "18px" }}
          />
          <span>{field.placeholder || field.label}</span>
        </label>
      );

    case "signature":
      return (
        <div
          style={{
            width: "100%",
            height: printMode ? "80px" : "60px",
            border: printMode ? "none" : "1px dashed var(--border, #d1d5db)",
            borderBottom: "1px solid #999",
            borderRadius: printMode ? 0 : "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: "12px",
          }}
        >
          {printMode ? "" : "مكان التوقيع"}
        </div>
      );

    case "date":
      if (!printMode) {
        return (
          <CalendarInput
            label={field.label}
            value={value}
            required={field.required}
            onChange={onChange}
          />
        );
      }

      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={baseStyle}
          required={field.required}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={baseStyle}
          required={field.required}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={baseStyle}
          required={field.required}
        />
      );
  }
}

/* ------------------------------------------------------------------ */
/*  FormViewer — the main print-ready form component                   */
/* ------------------------------------------------------------------ */

export function FormViewer({
  form,
  onClose,
  dialogId = "watany-form-preview-dialog",
}: {
  form: GovernedFormTemplate;
  onClose: () => void;
  dialogId?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [printMode, setPrintMode] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const resetScrollPosition = () => {
      formRef.current?.scrollTo?.({ top: 0, left: 0 });
      paperRef.current?.scrollTo?.({ top: 0, left: 0 });
      if (paperRef.current) {
        paperRef.current.scrollTop = 0;
        paperRef.current.scrollLeft = 0;
      }
      if (formRef.current) {
        formRef.current.scrollTop = 0;
        formRef.current.scrollLeft = 0;
      }
    };

    const snapToVisibleMobileArea = () => {
      const dialog = dialogRef.current ?? document.getElementById(dialogId);
      if (!(dialog instanceof HTMLElement)) return;

      const viewportHeight = globalThis.visualViewport?.height ?? globalThis.innerHeight;
      const stickyHeader = document.querySelector(".watany-mobile-shell__topbar, [aria-label='الشريط العلوي']");
      const bottomComposer = document.querySelector("form[aria-label='اسأل موطني']");
      const headerRect = stickyHeader instanceof HTMLElement ? stickyHeader.getBoundingClientRect() : null;
      const composerRect = bottomComposer instanceof HTMLElement ? bottomComposer.getBoundingClientRect() : null;
      const hasVisibleComposer = Boolean(
        composerRect
        && composerRect.height > 20
        && composerRect.top > 0
        && composerRect.top < viewportHeight,
      );
      const topPx = Math.max(72, Math.ceil((headerRect?.bottom ?? 64) + 8));
      const composerTop = hasVisibleComposer ? composerRect!.top : viewportHeight;
      const bottomPx = Math.max(0, Math.ceil(viewportHeight - composerTop) + 4);
      const heightPx = Math.max(240, Math.floor(viewportHeight - topPx - bottomPx));
      const topValue = `${topPx}px`;
      const bottomValue = `${bottomPx}px`;
      const heightValue = `${heightPx}px`;

      const alreadySnapped = dialog.classList.contains("form-viewer-overlay--mobile-card")
        && dialog.style.getPropertyValue("--watany-v1-snap-top").trim() === topValue
        && dialog.style.getPropertyValue("--watany-v1-snap-bottom").trim() === bottomValue
        && dialog.style.getPropertyValue("--watany-v1-snap-max-height").trim() === heightValue
        && dialog.style.getPropertyValue("overflow").trim() === "hidden";
      if (alreadySnapped) return;

      dialog.classList.add("form-viewer-overlay--mobile-card");
      dialog.style.setProperty("--watany-v1-snap-top", topValue, "important");
      dialog.style.setProperty("--watany-v1-snap-bottom", bottomValue, "important");
      dialog.style.setProperty("--watany-v1-header-snap-top-px", topValue, "important");
      dialog.style.setProperty("--watany-v1-header-snap-bottom-px", bottomValue, "important");
      dialog.style.setProperty("--watany-v1-body-portal-top-px", topValue, "important");
      dialog.style.setProperty("--watany-v1-body-portal-bottom-px", bottomValue, "important");
      dialog.style.setProperty("--watany-v1-snap-max-height", heightValue, "important");
      dialog.style.setProperty("--watany-v1-header-snap-max-height-px", heightValue, "important");
      dialog.style.setProperty("--watany-v1-body-portal-max-height-px", heightValue, "important");
      dialog.style.setProperty("top", topValue, "important");
      dialog.style.setProperty("bottom", bottomValue, "important");
      dialog.style.setProperty("height", heightValue, "important");
      dialog.style.setProperty("max-height", heightValue, "important");
      dialog.style.setProperty("overflow", "hidden", "important");
    };

    resetScrollPosition();
    snapToVisibleMobileArea();
    const snapFrame = globalThis.requestAnimationFrame(() => {
      snapToVisibleMobileArea();
      resetScrollPosition();
    });
    const snapTimeouts = [80, 180, 360, 720].map((delay) => globalThis.setTimeout(() => {
      snapToVisibleMobileArea();
      resetScrollPosition();
    }, delay));
    const snapObserverTarget = dialogRef.current;
    let snapObserver: MutationObserver | null = null;
    if (snapObserverTarget) {
      snapObserver = new MutationObserver(() => snapToVisibleMobileArea());
      snapObserver.observe(snapObserverTarget, { attributes: true, attributeFilter: ["style", "class"] });
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    globalThis.addEventListener("keydown", handleEscape);
    return () => {
      globalThis.cancelAnimationFrame(snapFrame);
      for (const timeoutId of snapTimeouts) {
        globalThis.clearTimeout(timeoutId);
      }
      snapObserver?.disconnect();
      globalThis.removeEventListener("keydown", handleEscape);
      previousActiveElement?.focus?.();
    };
  }, [dialogId, form.id, onClose]);

  const updateField = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handlePrint = () => {
    setPrintMode(true);
    // Small delay to let state update and render in print mode
    setTimeout(() => {
      globalThis.print();
      // Restore after print dialog closes
      setTimeout(() => setPrintMode(false), 500);
    }, 100);
  };

  const handleClearAll = () => {
    setValues({});
  };

  const handleDownload = async () => {
    const paper = document.getElementById("watany-form-print");
    if (!paper) return;

    // Temporarily switch to print mode for clean rendering
    setPrintMode(true);
    await new Promise((r) => setTimeout(r, 150));

    try {
      // Dynamic import — html2canvas is bundled with Vite
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(paper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      // Convert canvas to PDF-like image download
      const link = document.createElement("a");
      link.download = `${form.code}_${form.title_ar.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: Blob text download of the form HTML
      const html = paper.outerHTML;
      const fullHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${form.title_ar}</title><style>body{font-family:sans-serif;direction:rtl;padding:40px}*{box-sizing:border-box}.form-fields-grid{display:flex;flex-wrap:wrap;gap:16px}.form-field-wrapper{margin-bottom:12px}.form-field-label{display:block;font-weight:600;margin-bottom:4px;font-size:13px}.form-required{color:red;margin-right:4px}.form-version-tag{margin-top:24px;text-align:center;font-size:11px;opacity:0.5}</style></head><body>${html}</body></html>`;
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.code}_${form.title_ar.replace(/\s+/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintMode(false);
    }
  };

  const widthMap: Record<string, string> = {
    full: "100%",
    half: "calc(50% - 8px)",
    third: "calc(33.33% - 10px)",
  };

  const headerHtml = form.header_html ? sanitizePrintableHtml(form.header_html) : null;
  const footerHtml = form.footer_html ? sanitizePrintableHtml(form.footer_html) : null;
  const governanceStateLabel = getGovernanceStateLabel(form.governance);

  const viewer = (
    <dialog
      ref={dialogRef}
      className={`form-viewer-overlay ${printMode ? "form-print-mode" : ""}`}
      id={dialogId}
      open
      aria-labelledby="watany-form-viewer-title"
      aria-describedby={form.instructions_ar ? "watany-form-viewer-instructions" : undefined}
      data-form-viewer="true"
    >
      <div className="form-viewer-container" ref={formRef}>
        {/* Toolbar — hidden during print */}
        <div className="form-viewer-toolbar no-print">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button ref={closeButtonRef} type="button" className="form-btn form-btn-secondary" onClick={onClose} title="إغلاق">
              ✕
            </button>
            <span id="watany-form-viewer-title" style={{ fontWeight: 600, fontSize: "15px" }}>{form.title_ar}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="form-btn form-btn-ghost" onClick={handleClearAll} title="مسح جميع الحقول">
              مسح الكل
            </button>
            <button type="button" className="form-btn form-btn-primary wt-cta-glow wt-cta-processing" onClick={handleDownload} title="تحميل النموذج كصورة" aria-busy={false}>
              تحميل
            </button>
            <button type="button" className="form-btn form-btn-primary wt-cta-glow wt-cta-processing" onClick={handlePrint} title="طباعة النموذج" aria-busy={false}>
              طباعة
            </button>
          </div>
        </div>

        {/* Form content — this is what gets printed */}
        <div className="form-viewer-paper" id="watany-form-print" ref={paperRef}>
          {/* Official header */}
          {headerHtml && (
            <div dangerouslySetInnerHTML={{ __html: headerHtml }} />
          )}

          {/* Instructions */}
          {form.instructions_ar && (
            <div id="watany-form-viewer-instructions" className="form-instructions no-print">
              <strong>تعليمات:</strong> {form.instructions_ar}
            </div>
          )}

          {form.governance && (
            <div className="form-governance-note no-print">
              <div className="form-governance-note__title">
                <span>المصدر الرسمي</span>
                {governanceStateLabel ? <span className="form-governance-note__status">{governanceStateLabel}</span> : null}
              </div>
              <div className="form-governance-note__body">{form.governance.officialSourceLabel}</div>
              <div className="form-governance-note__meta">
                {form.governance.officialReference ? <span>{form.governance.officialReference}</span> : null}
                {form.governance.verifiedAt ? <span>تحقق {form.governance.verifiedAt}</span> : null}
                {form.sourceName ? <span>{form.sourceName}</span> : null}
                {form.governance.officialSourceUrl ? (
                  <a className="form-governance-link" href={form.governance.officialSourceUrl} target="_blank" rel="noreferrer">
                    الرابط الرسمي
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {/* Fields grid */}
          <div className="form-fields-grid">
            {(Array.isArray(form.fields) ? form.fields : []).map((field) => (
              <div
                key={field.id}
                className="form-field-wrapper"
                style={{ width: widthMap[field.width || "full"] }}
              >
                <label className="form-field-label">
                  {field.label}
                  {field.required && <span className="form-required">*</span>}
                </label>
                <FormFieldInput
                  field={field}
                  value={values[field.id] || ""}
                  onChange={(val) => updateField(field.id, val)}
                  printMode={printMode}
                />
              </div>
            ))}
          </div>

          {/* Official footer */}
          {footerHtml && (
            <div dangerouslySetInnerHTML={{ __html: footerHtml }} />
          )}

          {/* Version tag */}
          <div className="form-version-tag">
            الإصدار {form.version} — {form.authority}
          </div>
        </div>
      </div>
    </dialog>
  );

  if (!globalThis.document?.body) {
    return viewer;
  }

  return createPortal(viewer, globalThis.document.body);
}

/* ------------------------------------------------------------------ */
/*  FormCatalogPanel — browseable list of all forms                    */
/* ------------------------------------------------------------------ */

export function FormCatalogPanel({
  forms,
  onSelect,
}: Readonly<{
  forms: FormTemplate[];
  onSelect: (form: FormTemplate) => void;
}>) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? forms.filter(
        (f) =>
          f.code.includes(search) ||
          f.title_ar.includes(search) ||
          f.description_ar.includes(search) ||
          f.category.includes(search)
      )
    : forms;

  return (
    <div className="form-catalog">
      <div className="form-catalog-header">
        <h3 style={{ margin: 0 }}>النماذج الرسمية</h3>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--watany-subtitle-ink, #334155)" }}>
          اختر النموذج لتعبئته وطباعته بالشكل الرسمي
        </p>
      </div>

      <input
        className="form-catalog-search"
        type="text"
        placeholder="ابحث عن نموذج (ت2، طلاق، بطاقة خدمات...)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="form-catalog-grid">
        {filtered.map((form) => (
          <button
            key={form.id}
            data-feature-key={form.id}
            type="button"
            className="form-catalog-card"
            onClick={() => onSelect(form)}
          >
            <div className="form-card-title">{form.title_ar}</div>
            <div className="form-card-desc">{form.description_ar}</div>
            <div className="form-card-meta">
              <span>{form.authority}</span>
              <span>{(Array.isArray(form.fields) ? form.fields.length : 0)} حقل</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--watany-subtitle-ink, #334155)", gridColumn: "1 / -1" }}>
            لا توجد نماذج مطابقة للبحث
          </div>
        )}
      </div>
    </div>
  );
}
