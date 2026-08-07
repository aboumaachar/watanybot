'use client';

import { useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
};

export function MobileFullPopup({ open, title, children, onClose }: Props) {
  const touchStartX = useRef<number>(0);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose?.();
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (deltaX > 72) onClose?.();
  }

  return (
    <div
      className="watany-mobile-popup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir="rtl"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <section className="watany-mobile-popup">
        <header className="watany-card" style={{ position: 'sticky', top: 0, zIndex: 2, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong>{title}</strong>
            <button type="button" className="watany-action-icon" onClick={onClose}>إغلاق</button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}