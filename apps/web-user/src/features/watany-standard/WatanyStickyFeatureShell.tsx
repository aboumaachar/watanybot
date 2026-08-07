'use client';

import type { ReactNode } from 'react';
import type { WatanyFeatureCategory, WatanyIconAction } from './types';
import { FeatureIconBar } from './FeatureIconBar';

type Props = Readonly<{
  title: string;
  subtitle?: string;
  category?: WatanyFeatureCategory;
  actions?: WatanyIconAction[];
  children: ReactNode;
}>;

export function WatanyStickyFeatureShell({
  title,
  subtitle,
  category = 'informational',
  actions = [],
  children,
}: Props) {
  return (
    <section className="watany-mobile-shell" dir="rtl" data-category={category}>
      <header className="watany-sticky-header">
        <strong style={{ display: 'block', fontSize: 18 }}>{title}</strong>
        {subtitle ? <span style={{ color: 'var(--watany-subtitle-ink, var(--watany-muted))', fontSize: 13 }}>{subtitle}</span> : null}
      </header>
      {actions.length ? <FeatureIconBar actions={actions} /> : null}
      <main className="watany-main-content">{children}</main>
    </section>
  );
}