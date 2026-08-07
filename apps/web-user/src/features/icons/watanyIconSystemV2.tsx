import React from 'react';

export type WatanyIconKey =
  | 'apps-grid'
  | 'wallet-money'
  | 'graduation-cap'
  | 'clipboard-check'
  | 'briefcase'
  | 'store'
  | 'network-nodes'
  | 'people-group'
  | 'chat-bubble'
  | 'gear'
  | 'document-file'
  | 'law-book'
  | 'announcement'
  | 'notice-ribbon'
  | 'ballot'
  | 'user-profile'
  | 'help-guide'
  | 'calculator'
  | 'search'
  | 'phone'
  | 'star'
  | 'car'
  | 'calendar'
  | 'mail'
  | 'download'
  | 'upload'
  | 'folder'
  | 'video'
  | 'megaphone'
  | 'warning'
  | 'default';

export const WATANY_ICON_SYSTEM_V2 = {
  mainFeatureIcons: 'local-svg',
  topBarIcons: 'local-svg',
  bottomBarIcons: 'local-svg',
  newIconRule: 'Every new icon must be added to the local SVG registry',
  qualityProcessor: function () {
    return true;
  },
} as const;

const ICON_ALIASES: Record<string, WatanyIconKey> = {
  'wallet-money': 'wallet-money',
  money: 'wallet-money',
  salary: 'wallet-money',
  'graduation-cap-diploma': 'graduation-cap',
  'graduation-cap': 'graduation-cap',
  'clipboard-check': 'clipboard-check',
  'apps-grid': 'apps-grid',
  'briefcase': 'briefcase',
  store: 'store',
  'network-nodes': 'network-nodes',
  'people-group': 'people-group',
  'chat-bubble': 'chat-bubble',
  gear: 'gear',
  'document-file': 'document-file',
  'law-book': 'law-book',
  announcement: 'announcement',
  'notice-ribbon': 'notice-ribbon',
  ballot: 'ballot',
  'user-profile': 'user-profile',
  'help-guide': 'help-guide',
  calculator: 'calculator',
  search: 'search',
  phone: 'phone',
  star: 'star',
  car: 'car',
  calendar: 'calendar',
  mail: 'mail',
  download: 'download',
  upload: 'upload',
  folder: 'folder',
  video: 'video',
  megaphone: 'megaphone',
  warning: 'warning',
};

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function resolveWatanyIconKey(value: string | null | undefined): WatanyIconKey {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');

  return ICON_ALIASES[normalized] ?? 'default';
}

export function WatanyIconSignV2({ name }: { name: WatanyIconKey }) {
  switch (name) {
    case 'apps-grid':
    case 'default':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="11" y="11" width="16" height="16" rx="4" fill="currentColor" />
          <rect x="37" y="11" width="16" height="16" rx="4" fill="currentColor" opacity="0.88" />
          <rect x="11" y="37" width="16" height="16" rx="4" fill="currentColor" opacity="0.88" />
          <rect x="37" y="37" width="16" height="16" rx="4" fill="currentColor" opacity="0.72" />
        </svg>
      );
    case 'wallet-money':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M14 18h28a10 10 0 0 1 10 10v16a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8Z" fill="currentColor" opacity="0.92" />
          <path d="M13 16 39 10a6 6 0 0 1 7 4l2 4H13Z" fill="currentColor" opacity="0.58" />
          <circle cx="43" cy="34" r="6" fill="#fff" opacity="0.9" />
        </svg>
      );
    case 'graduation-cap':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M10 25 32 15l22 10-22 10-22-10Z" fill="currentColor" />
          <path d="M18 31v10c5 6 23 6 28 0V31L32 38 18 31Z" fill="currentColor" opacity="0.82" />
          <path d="M54 28v13" {...common} />
          <circle cx="54" cy="47" r="4" fill="currentColor" />
        </svg>
      );
    case 'clipboard-check':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="15" y="10" width="34" height="46" rx="8" fill="currentColor" opacity="0.92" />
          <rect x="23" y="6" width="18" height="12" rx="5" fill="#fff" opacity="0.95" />
          <path d="m24 35 6 6 12-14" {...common} strokeWidth={5} />
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M23 18v-3a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v3" {...common} />
          <rect x="8" y="18" width="48" height="34" rx="8" fill="currentColor" />
          <path d="M8 31h48" stroke="#fff" strokeWidth="5" opacity="0.76" />
        </svg>
      );
    case 'store':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M10 12h44l5 15c-3 7-11 7-16 2-5 6-15 6-21 0-4 5-13 5-17-2l5-15Z" fill="currentColor" />
          <rect x="12" y="30" width="40" height="24" rx="6" fill="currentColor" opacity="0.76" />
          <path d="M26 37h12v17H26z" fill="#fff" opacity="0.86" />
        </svg>
      );
    case 'network-nodes':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 22 42 14M20 43l24 8M18 24l26 24" {...common} opacity="0.76" />
          <circle cx="15" cy="22" r="8" fill="currentColor" />
          <circle cx="49" cy="13" r="8" fill="currentColor" />
          <circle cx="49" cy="51" r="8" fill="currentColor" />
        </svg>
      );
    case 'people-group':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="19" r="9" fill="currentColor" />
          <circle cx="16" cy="26" r="7" fill="currentColor" opacity="0.78" />
          <circle cx="48" cy="26" r="7" fill="currentColor" opacity="0.78" />
          <path d="M13 53c2-11 9-17 19-17s17 6 19 17H13Z" fill="currentColor" />
        </svg>
      );
    case 'chat-bubble':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M8 28c0-12 11-21 24-21s24 9 24 21-11 21-24 21c-3 0-6-.4-9-1.4L12 56l3-13C11 39 8 34 8 28Z" fill="currentColor" />
          <circle cx="23" cy="28" r="3.5" fill="#fff" />
          <circle cx="32" cy="28" r="3.5" fill="#fff" />
          <circle cx="41" cy="28" r="3.5" fill="#fff" />
        </svg>
      );
    case 'gear':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M35 6 39 14c2 .7 4 1.5 6 2.6l9-3 5 9-7 6c.2 2 .2 4 0 6l7 6-5 9-9-3a26 26 0 0 1-6 2.6L35 58H25l-4-8.8a26 26 0 0 1-6-2.6l-9 3-5-9 7-6a29 29 0 0 1 0-6l-7-6 5-9 9 3c2-1.1 4-2 6-2.6L25 6h10Z" fill="currentColor" />
          <circle cx="30" cy="32" r="10" fill="#fff" opacity="0.92" />
        </svg>
      );
    case 'document-file':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M13 6h22l11 11v41H13a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8Z" fill="currentColor" />
          <path d="M35 6v11h11" fill="#fff" opacity="0.88" />
          <path d="M19 28h26M19 36h26M19 44h16" {...common} stroke="#fff" strokeWidth={4} />
        </svg>
      );
    case 'law-book':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 10h22a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8Z" fill="currentColor" />
          <path d="M24 18h22" stroke="#fff" strokeWidth="4" opacity="0.9" />
          <path d="M25 28 38 41M38 28 25 41" {...common} stroke="#fff" strokeWidth={5} />
        </svg>
      );
    case 'announcement':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M10 28h8l18-10v28L18 36h-8z" fill="currentColor" />
          <path d="M18 28v8" stroke="#fff" strokeWidth="4" opacity="0.9" />
          <path d="M41 22c3 2 5 5 5 10s-2 8-5 10" {...common} opacity="0.9" />
          <path d="M47 17c5 4 8 9 8 15s-3 11-8 15" {...common} opacity="0.64" />
        </svg>
      );
    case 'notice-ribbon':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 8 54 16v16c0 14-9 22-22 28C19 54 10 46 10 32V16l22-8Z" fill="currentColor" />
          <path d="M32 20v16" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          <circle cx="32" cy="42" r="3.5" fill="#fff" />
        </svg>
      );
    case 'ballot':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="10" y="14" width="32" height="36" rx="8" fill="currentColor" />
          <path d="M24 22 30 28 40 16" {...common} stroke="#fff" strokeWidth={5} />
          <path d="M46 26h8v24a6 6 0 0 1-6 6H32" {...common} opacity="0.75" />
        </svg>
      );
    case 'user-profile':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="23" r="11" fill="currentColor" />
          <path d="M14 54c2-12 10-18 18-18s16 6 18 18H14Z" fill="currentColor" />
        </svg>
      );
    case 'help-guide':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="22" fill="currentColor" />
          <circle cx="32" cy="32" r="12" fill="#fff" opacity="0.94" />
          <path d="M32 21v22M21 32h22" {...common} stroke="#fff" strokeWidth={5} />
        </svg>
      );
    case 'calculator':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="17" y="8" width="30" height="48" rx="6" fill="currentColor" />
          <rect x="23" y="14" width="18" height="8" rx="3" fill="#fff" opacity="0.92" />
          <circle cx="24" cy="30" r="2.2" fill="#fff" />
          <circle cx="32" cy="30" r="2.2" fill="#fff" />
          <circle cx="40" cy="30" r="2.2" fill="#fff" />
          <circle cx="24" cy="39" r="2.2" fill="#fff" />
          <circle cx="32" cy="39" r="2.2" fill="#fff" />
          <circle cx="40" cy="39" r="2.2" fill="#fff" />
          <circle cx="24" cy="48" r="2.2" fill="#fff" />
          <circle cx="32" cy="48" r="2.2" fill="#fff" />
          <circle cx="40" cy="48" r="2.2" fill="#fff" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="28" cy="28" r="13" {...common} fill="currentColor" />
          <path d="m39 39 12 12" {...common} strokeWidth={5} />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M15 9 22 21c.4.7.2 1.6-.4 2.1l-3 2.4c2.7 5.2 6.7 9.1 11.9 11.9l2.4-3c.5-.6 1.4-.8 2.1-.4L49 45c.9.5 1.3 1.7.7 2.6l-2 3.3c-.7 1.1-2 1.6-3.2 1.4C24 48.7 15.3 40 11.7 22.5c-.2-1.2.3-2.5 1.4-3.2l3.3-2c.9-.6 2.1-.2 2.6.7Z" fill="currentColor" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="m32 10 7 14 15 2-11 11 3 15-14-7-14 7 3-15-11-11 15-2z" fill="currentColor" />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M14 30 18 18h28l4 12" {...common} />
          <path d="M12 30h40v16H12z" fill="currentColor" />
          <circle cx="20" cy="49" r="4" fill="#fff" />
          <circle cx="44" cy="49" r="4" fill="#fff" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="10" y="14" width="44" height="38" rx="8" fill="currentColor" />
          <path d="M10 24h44" stroke="#fff" strokeWidth="5" opacity="0.9" />
          <path d="M20 8v12M44 8v12" {...common} stroke="#fff" strokeWidth={5} />
        </svg>
      );
    case 'mail':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="10" y="16" width="44" height="32" rx="6" fill="currentColor" />
          <path d="m12 20 20 16 20-16" {...common} stroke="#fff" strokeWidth={5} />
          <path d="m12 44 14-12" {...common} stroke="#fff" strokeWidth={5} />
          <path d="m52 44-14-12" {...common} stroke="#fff" strokeWidth={5} />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 12v24" {...common} strokeWidth={5} />
          <path d="m22 28 10 10 10-10" {...common} strokeWidth={5} />
          <path d="M14 50h36" {...common} />
        </svg>
      );
    case 'upload':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 52V28" {...common} strokeWidth={5} />
          <path d="m22 38 10-10 10 10" {...common} strokeWidth={5} />
          <path d="M14 14h36" {...common} />
        </svg>
      );
    case 'folder':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M10 18h16l5 6h23a5 5 0 0 1 5 5v17a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7V25a7 7 0 0 1 7-7Z" fill="currentColor" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="10" y="16" width="44" height="32" rx="6" fill="currentColor" />
          <path d="m28 24 14 8-14 8z" fill="#fff" opacity="0.94" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M10 28h8l20-10v28L18 36h-8z" fill="currentColor" />
          <path d="M18 28v10" {...common} stroke="#fff" strokeWidth={5} />
          <path d="M42 22c4 3 6 7 6 12s-2 9-6 12" {...common} opacity="0.88" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 8 56 52H8L32 8Z" fill="currentColor" />
          <path d="M32 24v14" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          <circle cx="32" cy="43" r="3.5" fill="#fff" />
        </svg>
      );
  }
}
