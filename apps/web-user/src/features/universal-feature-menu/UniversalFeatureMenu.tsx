import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import KoudamaFeatureIcon from "../../components/koudama-icons/KoudamaFeatureIcon";
import { UNIVERSAL_FEATURE_GROUPS, getUniversalFeatureGroupForPath, type UniversalFeatureMenuGroup, type UniversalFeatureMenuItem } from "./universalFeatureMenuRegistry";

type UniversalFeatureMenuProps = Readonly<{
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  activeGroupId?: string;
  focusActiveGroupOnOpen?: boolean;
}>;

function UniversalChildItem({
  item,
  onSelect,
}: Readonly<{
  item: UniversalFeatureMenuItem;
  onSelect: (item: UniversalFeatureMenuItem) => void;
}>) {
  return (
    <button type="button" className="watany-universal-feature-menu__child-button" onClick={() => onSelect(item)} data-menu-item-id={item.id}>
      <span className="watany-universal-feature-menu__child-button-icon" aria-hidden="true">
        <KoudamaFeatureIcon featureId={item.iconFeatureId} size="md" renderMode="filled" />
      </span>
      <span className="watany-universal-feature-menu__child-button-label">{item.label}</span>
    </button>
  );
}

function UniversalAccordionGroup({
  group,
  active,
  expanded,
  onSelect,
  onToggle,
}: Readonly<{
  group: UniversalFeatureMenuGroup;
  active: boolean;
  expanded: boolean;
  onSelect: (item: UniversalFeatureMenuItem) => void;
  onToggle: (group: UniversalFeatureMenuGroup) => void;
}>) {
  if (group.items.length === 0) {
    return (
      <button
        type="button"
        className={active ? "watany-universal-feature-menu__group-button is-active" : "watany-universal-feature-menu__group-button"}
        onClick={() => onSelect({ id: group.id, label: group.label, route: group.route, iconFeatureId: group.iconFeatureId })}
      >
        <span className="watany-universal-feature-menu__group-icon" aria-hidden="true">
          <KoudamaFeatureIcon featureId={group.iconFeatureId} size="sm" renderMode="filled" />
        </span>
        <span className="watany-universal-feature-menu__group-label">{group.label}</span>
      </button>
    );
  }

  return (
    <div className={expanded ? "watany-universal-feature-menu__group is-expanded" : "watany-universal-feature-menu__group"}>
      <button
        type="button"
        className={active ? "watany-universal-feature-menu__group-button is-active" : "watany-universal-feature-menu__group-button"}
        onClick={() => onToggle(group)}
        aria-expanded={expanded}
        aria-controls={`watany-universal-feature-menu-group-${group.id}`}
      >
        <span className="watany-universal-feature-menu__group-icon" aria-hidden="true">
          <KoudamaFeatureIcon featureId={group.iconFeatureId} size="sm" renderMode="filled" />
        </span>
        <span className="watany-universal-feature-menu__group-label">{group.label}</span>
      </button>

      <div
        id={`watany-universal-feature-menu-group-${group.id}`}
        className={expanded ? "watany-universal-feature-menu__group-children is-expanded" : "watany-universal-feature-menu__group-children"}
        role="group"
        aria-label={group.label}
        aria-hidden={!expanded}
      >
        {group.items.map((item) => (
          <UniversalChildItem key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export default function UniversalFeatureMenu({ open, onToggle, onClose, activeGroupId, focusActiveGroupOnOpen = false }: UniversalFeatureMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const activeGroup = getUniversalFeatureGroupForPath(location.pathname);
  const [expandedGroupId, setExpandedGroupId] = useState<string>("");

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };

    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("pointerdown", onPointerDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setExpandedGroupId("");
    }
  }, [open]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (open) {
      html.classList.add("watany-main-menu-open");
      body.classList.add("watany-main-menu-open");
    } else {
      html.classList.remove("watany-main-menu-open");
      body.classList.remove("watany-main-menu-open");
    }

    return () => {
      html.classList.remove("watany-main-menu-open");
      body.classList.remove("watany-main-menu-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) {
      return;
    }

    panelRef.current.scrollTop = 0;
  }, [open, location.pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const groupIdToExpand = activeGroupId || activeGroup.id;
    if (groupIdToExpand && (focusActiveGroupOnOpen || expandedGroupId === "")) {
      setExpandedGroupId(groupIdToExpand);
    }
  }, [activeGroup.id, activeGroupId, expandedGroupId, focusActiveGroupOnOpen, open]);

  function openRoute(route: string) {
    onClose();
    navigate(route);
  }

  function handleGroup(group: UniversalFeatureMenuGroup) {
    setExpandedGroupId((current) => (current === group.id ? "" : group.id));
  }

  function handleItem(item: UniversalFeatureMenuItem) {
    openRoute(item.route);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    touchStartXRef.current = touch?.clientX ?? null;
    touchStartYRef.current = touch?.clientY ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const touch = event.changedTouches[0];
    const endX = touch?.clientX ?? null;
    const endY = touch?.clientY ?? null;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null || endX === null || endY === null) {
      return;
    }

    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);

    if (deltaX > 60 && deltaY < 50) {
      onClose();
    }
  }

  const activeGroupLabel = activeGroup.label;
  const activeGroupCount = activeGroup.items.length;

  function handleCloseMenu() {
    onClose();
  }

  return (
    <section className="watany-universal-feature-menu" data-watany-universal-feature-menu="true" data-open={open} dir="rtl">
      <div className="watany-universal-feature-menu__toolbar" role="toolbar" aria-label="شريط القوائم الموحد">
        <button
          type="button"
          className="watany-universal-feature-menu__trigger"
          data-testid="watany-main-menu-toggle"
          aria-expanded={open}
          aria-controls="watany-universal-feature-menu-panel"
          onClick={onToggle}
        >
          <span className="watany-universal-feature-menu__burger" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>القائمة</span>
        </button>

        <button
          type="button"
          className="watany-universal-feature-menu__chip"
          onClick={onToggle}
          aria-label={`القسم الحالي: ${activeGroupLabel}`}
        >
          <span className="watany-universal-feature-menu__chip-icon" aria-hidden="true">
            <KoudamaFeatureIcon featureId={activeGroup.iconFeatureId} size="sm" renderMode="filled" />
          </span>
          <span className="watany-universal-feature-menu__chip-label">{activeGroupLabel}</span>
          <span className="watany-universal-feature-menu__chip-count">{activeGroupCount}</span>
        </button>

        <button
          type="button"
          className="watany-universal-feature-menu__search"
          aria-label="فتح البحث"
          onClick={() => openRoute("/search")}
        >
          <KoudamaFeatureIcon featureId="search" size="sm" />
        </button>
      </div>

      {/* ── Dropdown panel (open state) ── */}
      <div className="watany-universal-feature-menu__panel-container">
        <button
          type="button"
          className={open ? "watany-universal-feature-menu__overlay is-open" : "watany-universal-feature-menu__overlay"}
          data-testid="watany-main-menu-overlay"
          aria-label="إغلاق القائمة"
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          onClick={handleCloseMenu}
        />
        <nav
          id="watany-universal-feature-menu-panel"
          ref={panelRef}
          className="watany-universal-feature-menu__panel"
          data-testid="watany-main-menu-drawer"
          aria-label="universal feature menu"
          aria-hidden={!open}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="watany-universal-feature-menu__panel-head">
            <strong className="watany-universal-feature-menu__panel-title">القائمة</strong>
            <button type="button" className="watany-universal-feature-menu__close" aria-label="إغلاق القائمة" onClick={handleCloseMenu}>
              ×
            </button>
          </div>
          <div
            className="watany-universal-feature-menu__accordion"
            aria-label="feature groups"
            data-testid="watany-main-menu-primary-links"
          >
            {UNIVERSAL_FEATURE_GROUPS.map((group) => (
              <UniversalAccordionGroup
                key={group.id}
                group={group}
                active={group.id === activeGroup.id}
                expanded={expandedGroupId === group.id}
                onSelect={handleItem}
                onToggle={handleGroup}
              />
            ))}
          </div>
        </nav>
      </div>
    </section>
  );
}