import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../store/app";
import type { VisualTheme, LayoutMode, NavStyle, DesignConfig } from "../types/design";
import { THEME_LABELS, LAYOUT_LABELS, NAV_LABELS } from "../types/design";
import { WatanyFluentIcon, type WatanyIconName } from "./icons/WatanyFluentIcon";

const CARD_ICON_SIZE = 56;
const CARD_ICON_RADIUS = 16;
const CARD_PADDING = "14px";
const CARD_GAP = 10;

const THEMES: VisualTheme[] = ["glassmorphism", "neubrutalism", "minimal-flat", "neumorphism"];
const LAYOUTS: LayoutMode[] = ["floating-bubble", "command-palette", "split-pane"];
const NAVS: NavStyle[] = ["bottom-tab-rail", "hamburger", "ai-driven"];

const THEME_DESCRIPTIONS_AR: Record<VisualTheme, string> = {
  glassmorphism: "واجهات شفافة بطابع حديث وحركة هادئة.",
  neubrutalism: "حدود بارزة وتباين قوي لإبراز العناصر الأساسية.",
  "minimal-flat": "تصميم مبسط واضح يركز على سهولة القراءة.",
  neumorphism: "أسطح ناعمة ولمسات هادئة تمنح إحساسا بصريا مريحا.",
};

const LAYOUT_DESCRIPTIONS_AR: Record<LayoutMode, string> = {
  "floating-bubble": "فتح المحادثة من زر عائم مع إبقاء الصفحات في الخلفية.",
  "command-palette": "عرض المحادثة في لوحة مركزية مع وصول سريع للأوامر.",
  "split-pane": "تقسيم الشاشة بين المحادثة والسياق لعرض موسع.",
};

const NAV_DESCRIPTIONS_AR: Record<NavStyle, string> = {
  "bottom-tab-rail": "شريط سفلي على الهاتف ومسار جانبي على الشاشات الأكبر.",
  hamburger: "قائمة جانبية تجمع الصفحات والخيارات في مكان واحد.",
  "ai-driven": "التنقل بين الأقسام عبر توجيه المحادثة بشكل مباشر.",
};

const LAYOUT_ICONS: Record<LayoutMode, WatanyIconName> = {
  "floating-bubble": "chat",
  "command-palette": "apps",
  "split-pane": "document",
};

const NAV_ICONS: Record<NavStyle, WatanyIconName> = {
  "bottom-tab-rail": "phone",
  hamburger: "list",
  "ai-driven": "bot",
};

const THEME_COLORS: Record<VisualTheme, string> = {
  glassmorphism: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  neubrutalism: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
  "minimal-flat": "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
  neumorphism: "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(6px)",
  fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
};

const panelStyle: React.CSSProperties = {
  width: "min(820px, calc(100vw - 24px))",
  maxHeight: "calc(100vh - 40px)",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  padding: "32px 28px",
  boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
  color: "#1e293b",
  direction: "rtl",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  margin: "20px 0 12px",
  color: "#334155",
};

const optionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 16,
};

const optionBase: React.CSSProperties = {
  padding: CARD_PADDING,
  borderRadius: 20,
  border: "2px solid #e2e8f0",
  background: "#f8fafc",
  cursor: "pointer",
  textAlign: "center",
  transition: "all 0.2s ease",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateRows: "auto auto 1fr",
  justifyItems: "center",
  gap: CARD_GAP,
  aspectRatio: "1 / 1",
  fontFamily: "inherit",
  fontSize: "0.85rem",
};

const optionSelected: React.CSSProperties = {
  ...optionBase,
  border: "2px solid #6366f1",
  background: "#eef2ff",
  boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
  paddingTop: 16,
  borderTop: "1px solid #e2e8f0",
};

export function DesignSelector() {
  const { design, setDesign, designSelectorOpen, setDesignSelectorOpen } = useApp();
  const [draft, setDraft] = useState<DesignConfig>({ ...design });

  useEffect(() => {
    if (designSelectorOpen) setDraft({ ...design });
  }, [designSelectorOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!designSelectorOpen) return null;

  const apply = () => {
    setDesign(draft);
    setDesignSelectorOpen(false);
  };

  const cancel = () => {
    setDraft({ ...design });
    setDesignSelectorOpen(false);
  };

  const content = (
    <dialog
      style={overlayStyle}
      open
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <button
        type="button"
        aria-label="إغلاق نافذة تخصيص الواجهة"
        onClick={cancel}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "transparent",
          cursor: "default",
        }}
      />

      <div style={{ ...panelStyle, position: "relative", zIndex: 1 }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>تخصيص الواجهة</h2>
        <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "6px 0 0" }}>
          اختر المظهر وتنسيق العرض وأسلوب التنقل بما يلائم طريقة استخدامك.
        </p>

        <div style={sectionTitleStyle}>المظهر البصري</div>
        <div style={optionsGridStyle}>
          {THEMES.map((t) => (
            <button key={t} style={draft.theme === t ? optionSelected : optionBase} onClick={() => setDraft({ ...draft, theme: t })}>
              <div
                style={{
                  width: CARD_ICON_SIZE,
                  height: CARD_ICON_SIZE,
                  borderRadius: CARD_ICON_RADIUS,
                  background: THEME_COLORS[t],
                  boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                }}
              />
              <div style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35 }}>{THEME_LABELS[t].ar}</div>
              <div style={{ fontSize: "0.7rem", color: "#6366f1" }}>{THEME_LABELS[t].en}</div>
              <div style={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.45 }}>{THEME_DESCRIPTIONS_AR[t]}</div>
            </button>
          ))}
        </div>

        <div style={sectionTitleStyle}>تنسيق العرض</div>
        <div style={optionsGridStyle}>
          {LAYOUTS.map((l) => (
            <button key={l} style={draft.layout === l ? optionSelected : optionBase} onClick={() => setDraft({ ...draft, layout: l })}>
              <div
                style={{
                  width: CARD_ICON_SIZE,
                  height: CARD_ICON_SIZE,
                  borderRadius: CARD_ICON_RADIUS,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  fontSize: 28,
                  boxShadow: "0 10px 24px rgba(99,102,241,0.24)",
                }}
              >
                <WatanyFluentIcon name={LAYOUT_ICONS[l]} aria-hidden />
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35 }}>{LAYOUT_LABELS[l].ar}</div>
              <div style={{ fontSize: "0.7rem", color: "#6366f1" }}>{LAYOUT_LABELS[l].en}</div>
              <div style={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.45 }}>{LAYOUT_DESCRIPTIONS_AR[l]}</div>
            </button>
          ))}
        </div>

        <div style={sectionTitleStyle}>أسلوب التنقل</div>
        <div style={optionsGridStyle}>
          {NAVS.map((n) => (
            <button key={n} style={draft.nav === n ? optionSelected : optionBase} onClick={() => setDraft({ ...draft, nav: n })}>
              <div
                style={{
                  width: CARD_ICON_SIZE,
                  height: CARD_ICON_SIZE,
                  borderRadius: CARD_ICON_RADIUS,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                  color: "#fff",
                  fontSize: 28,
                  boxShadow: "0 10px 24px rgba(14,165,233,0.22)",
                }}
              >
                <WatanyFluentIcon name={NAV_ICONS[n]} aria-hidden />
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.35 }}>{NAV_LABELS[n].ar}</div>
              <div style={{ fontSize: "0.7rem", color: "#6366f1" }}>{NAV_LABELS[n].en}</div>
              <div style={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.45 }}>{NAV_DESCRIPTIONS_AR[n]}</div>
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: "#f1f5f9",
            borderRadius: 12,
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            fontSize: "0.85rem",
          }}
        >
          <div><span style={{ color: "#94a3b8" }}>المظهر: </span><strong>{THEME_LABELS[draft.theme].ar}</strong></div>
          <div><span style={{ color: "#94a3b8" }}>التنسيق: </span><strong>{LAYOUT_LABELS[draft.layout].ar}</strong></div>
          <div><span style={{ color: "#94a3b8" }}>الملاحة: </span><strong>{NAV_LABELS[draft.nav].ar}</strong></div>
        </div>

        <div style={footerStyle}>
          <button
            onClick={cancel}
            style={{
              padding: "10px 28px",
              borderRadius: 999,
              cursor: "pointer",
              background: "transparent",
              border: "1px solid #cbd5e1",
              color: "#475569",
              fontSize: "0.9rem",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            إلغاء
          </button>
          <button
            onClick={apply}
            style={{
              padding: "10px 36px",
              borderRadius: 999,
              cursor: "pointer",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
            }}
          >
            ✓ تطبيق
          </button>
        </div>
      </div>
    </dialog>
  );

  return createPortal(content, document.body);
}

export function DesignTrigger() {
  const { setDesignSelectorOpen } = useApp();
  const [hover, setHover] = useState(false);

  const btn = (
    <button
      onClick={() => setDesignSelectorOpen(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="تخصيص الواجهة - Customize"
      aria-label="Customize design"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 20px 12px 16px",
        borderRadius: 999,
        background: hover ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        border: "none",
        boxShadow: hover
          ? "0 8px 28px rgba(99,102,241,0.5), 0 0 0 4px rgba(99,102,241,0.15)"
          : "0 4px 18px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.1)",
        cursor: "pointer",
        fontSize: "0.9rem",
        fontWeight: 700,
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        transform: hover ? "translateY(-3px) scale(1.04)" : "translateY(0)",
        transition: "all 0.25s ease",
        animation: "ds-fab-pulse 2.5s ease-in-out 3",
      }}
    >
      <WatanyFluentIcon name="settings" aria-hidden />
      <span>تخصيص</span>
    </button>
  );

  return createPortal(
    <>
      <style>{`
        @keyframes ds-fab-pulse {
          0%, 100% { box-shadow: 0 4px 18px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.1); }
          50% { box-shadow: 0 4px 28px rgba(99,102,241,0.6), 0 0 0 8px rgba(99,102,241,0.12); }
        }
      `}</style>
      {btn}
    </>,
    document.body,
  );
}
