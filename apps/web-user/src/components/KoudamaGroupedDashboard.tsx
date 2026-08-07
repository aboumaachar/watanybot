import React from 'react';
import { SERVICE_CATEGORIES as koudamaRawCatalog } from '../lib/service-catalog';
import {
  groupCatalogByKoudamaSitemap,
  resolveKoudamaPinnedActions,
  type KoudamaCatalogLike,
} from '../lib/koudamaSitemapGroupingAdapter';
// APEX_CSS_FREEZE_DISABLED_IMPORT import './koudama-grouped-dashboard.css';
import KoudamaFeatureIcon from './koudama-icons/KoudamaFeatureIcon';

function getKoudamaDashboardFeatureId(item: DisplayCatalogItem): string {
  const record = item as unknown as Record<string, unknown>;
  const raw =
    record.featureId ??
    record.id ??
    record.key ??
    record.itemId ??
    record.href ??
    record.path ??
    record.route ??
    record.title ??
    record.label ??
    'services';

  const text = String(raw || 'services').trim();
  const clean = text.replace(/^\/+/, '').split(/[?#]/)[0];
  const tail = clean.split('/').filter(Boolean).pop();
  return tail || clean || 'services';
}


type DisplayCatalogItem = KoudamaCatalogLike & {
  title?: string;
  label?: string;
  name?: string;
  description?: string;
  subtitle?: string;
  href?: string;
  path?: string;
  route?: string;
  badge?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | string;
  Icon?: React.ComponentType<{ className?: string }>;
};

const ADMIN_ONLY_SITEMAP_IDS = new Set(['kb_studio', 'feature_controls']);

function normalizeCatalog(raw: unknown): DisplayCatalogItem[] {
  if (Array.isArray(raw)) return raw as DisplayCatalogItem[];
  if (raw && typeof raw === 'object') return Object.values(raw) as DisplayCatalogItem[];
  return [];
}

function itemTitle(item: DisplayCatalogItem): string {
  return item.title || item.label || item.name || item.id || item.key || 'خدمة';
}

function itemDescription(item: DisplayCatalogItem): string {
  return item.description || item.subtitle || '';
}

function itemHref(item: DisplayCatalogItem): string {
  return item.href || item.path || item.route || '#';
}

function renderIcon(item: DisplayCatalogItem) {
  const Icon = item.Icon || item.icon;
  if (typeof Icon === 'function') {
    return (
      <KoudamaFeatureIcon
        featureId={getKoudamaDashboardFeatureId(item)}
        size="lg"
        renderMode="filled"
        className="koudama-grouped-dashboard__icon-svg"
      />
    );
  }
  if (typeof Icon === 'string' && Icon.trim()) return <span className="koudama-grouped-dashboard__icon-emoji">{Icon}</span>;
  return <span className="koudama-grouped-dashboard__icon-dot" aria-hidden="true" />;
}

function cardFor(item: DisplayCatalogItem, number: string) {
  const href = itemHref(item);
  const title = itemTitle(item);
  const description = itemDescription(item);

  return (
    <a className="koudama-grouped-dashboard__card" href={href} data-koudama-dashboard-item={item.id || item.key || title}>
      <span className="koudama-grouped-dashboard__number">{number}</span>
      <span className="koudama-grouped-dashboard__icon">{renderIcon(item)}</span>
      <span className="koudama-grouped-dashboard__copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      {item.badge ? <span className="koudama-grouped-dashboard__badge">{item.badge}</span> : null}
    </a>
  );
}

export function KoudamaGroupedDashboard() {
  const catalogItems = normalizeCatalog(koudamaRawCatalog);
  const pinned = resolveKoudamaPinnedActions(catalogItems).filter((entry) => {
    return entry.catalogItem && !ADMIN_ONLY_SITEMAP_IDS.has(entry.pinnedAction.id);
  });
  const grouped = groupCatalogByKoudamaSitemap(catalogItems).map((section) => ({
    ...section,
    items: section.items.filter((entry) => !ADMIN_ONLY_SITEMAP_IDS.has(entry.sitemapItem.id)),
  })).filter((section) => section.items.length > 0);

  return (
    <section className="koudama-grouped-dashboard" data-koudama-grouped-dashboard dir="rtl" aria-label="خدمات موطني">
      <div className="koudama-grouped-dashboard__header">
        <span className="koudama-grouped-dashboard__eyebrow">خدماتي</span>
        <h2>كل الخدمات مرتبة حسب حاجتك</h2>
        <p>ترتيب جديد يحافظ على نفس الخدمات والأيقونات والمسارات، ويجمعها ضمن مجموعات واضحة.</p>
      </div>

      {pinned.length ? (
        <div className="koudama-grouped-dashboard__pinned" aria-label="إجراءات سريعة">
          {pinned.map((entry) => cardFor(entry.catalogItem as DisplayCatalogItem, entry.pinnedAction.number))}
        </div>
      ) : null}

      <div className="koudama-grouped-dashboard__groups">
        {grouped.map((section) => (
          <section className="koudama-grouped-dashboard__group" key={section.group.id} data-koudama-dashboard-group={section.group.id}>
            <div className="koudama-grouped-dashboard__group-title">
              <span>{section.group.number}</span>
              <h3>{section.group.displayTitle}</h3>
              <small>{section.group.formalTitle}</small>
            </div>
            <div className="koudama-grouped-dashboard__grid">
              {section.items.map((entry) => cardFor(entry.catalogItem as DisplayCatalogItem, entry.sitemapItem.number))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
