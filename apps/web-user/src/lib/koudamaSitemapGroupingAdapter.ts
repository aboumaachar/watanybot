import {
  KOUDAMA_PINNED_ACTIONS_V1,
  KOUDAMA_SITEMAP_GROUPS_V1,
  type KoudamaPinnedAction,
  type KoudamaSitemapGroup,
  type KoudamaSitemapItem,
} from '../config/koudamaNumberedSitemap.v1';

export type KoudamaCatalogLike = Record<string, unknown> & {
  id?: string;
  key?: string;
  slug?: string;
  label?: string;
  title?: string;
  name?: string;
  href?: string;
  path?: string;
  route?: string;
};

export interface KoudamaGroupedCatalogSection<T extends KoudamaCatalogLike> {
  group: KoudamaSitemapGroup;
  items: Array<{
    sitemapItem: KoudamaSitemapItem;
    catalogItem: T;
  }>;
}

export interface KoudamaPinnedCatalogAction<T extends KoudamaCatalogLike> {
  pinnedAction: KoudamaPinnedAction;
  catalogItem?: T;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ـ]/g, '');
}

function collectItemText(item: KoudamaCatalogLike): string {
  return [
    item.id,
    item.key,
    item.slug,
    item.label,
    item.title,
    item.name,
    item.href,
    item.path,
    item.route,
  ].map(toText).filter(Boolean).join(' ');
}

function routeOf(item: KoudamaCatalogLike): string {
  return toText(item.href) || toText(item.path) || toText(item.route);
}

function matchesSitemapItem(catalogItem: KoudamaCatalogLike, sitemapItem: KoudamaSitemapItem): boolean {
  const haystack = normalizeText(collectItemText(catalogItem));
  const catalogRoute = routeOf(catalogItem);

  if (catalogRoute && sitemapItem.routes.includes(catalogRoute)) return true;

  return sitemapItem.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalizedAlias.length > 0 && haystack.includes(normalizedAlias);
  });
}

export function resolveKoudamaSitemapItem(catalogItem: KoudamaCatalogLike): KoudamaSitemapItem | undefined {
  for (const group of KOUDAMA_SITEMAP_GROUPS_V1) {
    const found = group.items.find((item) => matchesSitemapItem(catalogItem, item));
    if (found) return found;
  }

  return KOUDAMA_PINNED_ACTIONS_V1.find((item) => matchesSitemapItem(catalogItem, item));
}

export function groupCatalogByKoudamaSitemap<T extends KoudamaCatalogLike>(
  catalogItems: T[],
): KoudamaGroupedCatalogSection<T>[] {
  return KOUDAMA_SITEMAP_GROUPS_V1.map((group) => {
    const items = group.items
      .map((sitemapItem) => {
        const catalogItem = catalogItems.find((entry) => matchesSitemapItem(entry, sitemapItem));
        if (!catalogItem) return undefined;
        return { sitemapItem, catalogItem };
      })
      .filter((entry): entry is { sitemapItem: KoudamaSitemapItem; catalogItem: T } => Boolean(entry));

    return { group, items };
  });
}

export function resolveKoudamaPinnedActions<T extends KoudamaCatalogLike>(
  catalogItems: T[],
): KoudamaPinnedCatalogAction<T>[] {
  return KOUDAMA_PINNED_ACTIONS_V1.map((pinnedAction) => ({
    pinnedAction,
    catalogItem: catalogItems.find((entry) => matchesSitemapItem(entry, pinnedAction)),
  }));
}

export function getUngroupedKoudamaCatalogItems<T extends KoudamaCatalogLike>(catalogItems: T[]): T[] {
  return catalogItems.filter((item) => !resolveKoudamaSitemapItem(item));
}