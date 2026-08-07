import { useState } from "react";
import { WatanyFluentIcon, type WatanyIconName } from "../icons/WatanyFluentIcon";
import { NAV_ITEMS } from "./navItems";

/**
 * HamburgerNav — Slide-out drawer with all nav items.
 */
export function HamburgerNav({
  activeMode,
  onSelect,
  badgeCounts,
}: {
  readonly activeMode: string;
  readonly onSelect: (id: string) => void;
  readonly badgeCounts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      {/* Hamburger button */}
      <button className="nav-hamburger-btn ds-btn-ghost" onClick={() => setOpen(!open)} aria-label="القائمة">
        {open ? "✕" : "☰"}
      </button>

      {/* Backdrop */}
      {open && <button className="nav-hamburger-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />}

      {/* Drawer */}
      <nav className={`nav-hamburger-drawer ds-card ${open ? "open" : ""}`}>
        <div style={{ marginBottom: "var(--sp-6)" }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>🇱🇧 موطني</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: 4 }}>مساعد المتقاعدين</div>
        </div>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            data-feature-key={item.id}
            className={`drawer-item ${activeMode === item.id ? "active" : ""}`}
            onClick={() => handleSelect(item.id)}
          >
            <span className="drawer-icon"><WatanyFluentIcon name={item.icon as WatanyIconName} aria-hidden /></span>
            <span>{item.label}</span>
            {badgeCounts?.[item.id] ? (
              <span className="ds-badge" style={{ marginInlineStart: "auto" }}>{badgeCounts[item.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.

