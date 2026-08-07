import { IconShell } from '../../components/IconShell';

export type KoudamaIconTone = 'blue' | 'green' | 'teal' | 'red' | 'gold' | 'purple' | 'gray' | 'pink';

export type KoudamaIconKey =
  | 'briefcase'
  | 'document'
  | 'person'
  | 'people'
  | 'home'
  | 'scales'
  | 'grid'
  | 'calculator'
  | 'mail'
  | 'chat'
  | 'poll'
  | 'calendar'
  | 'mic'
  | 'bookmark'
  | 'bell'
  | 'megaphone'
  | 'warning'
  | 'folder'
  | 'link'
  | 'pin'
  | 'heart'
  | 'plus'
  | 'book'
  | 'settings'
  | 'taxi'
  | 'search'
  | 'install'
  | 'worldCup'
  | 'calcTools'
  | 'networkNodes';

const GLYPH_OPTICAL_TRANSFORMS: Partial<Record<KoudamaIconKey, string>> = {
  document: 'translate(-1.1 0)',
  megaphone: 'translate(-0.9 0)',
  heart: 'translate(0 -0.8)',
  chat: 'translate(-0.45 0)',
};

function renderServiceIconGlyph(icon: KoudamaIconKey) {
  switch (icon) {
    case 'briefcase':
      return (
        <>
          <path d="M5 8.5A2.5 2.5 0 0 1 7.5 6h2V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1h2A2.5 2.5 0 0 1 19 8.5v8A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5z" />
          <path d="M9.5 6h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 11.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 13.5h4v2h-4z" fill="currentColor" stroke="none" />
        </>
      );
    case 'document':
      return (
        <>
          <path d="M6 10.5 16.5 7v10L6 13.5z" />
          <path d="M16.5 9h1.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 12.2v4a2 2 0 0 0 2 2h1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.8 8c1 .7 1.7 1.9 1.7 3.1s-.7 2.4-1.7 3.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'person':
      return (
        <>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </>
      );
    case 'people':
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
          <circle cx="12" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.8M2 21v-2a4 4 0 0 1 3-3.8" />
        </>
      );
    case 'home':
      return <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />;
    case 'scales':
      return (
        <>
          <path d="M12 3v18M5 6h14M6 6l-3 7h6zm12 0-3 7h6z" />
          <path d="M8 21h8" />
        </>
      );
    case 'grid':
      return (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </>
      );
    case 'calculator':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.4" />
          <rect x="7.2" y="5.5" width="9.6" height="3.2" rx="1" fill="currentColor" stroke="none" />
          <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.2h.01M12 15.2h.01M15.5 15.2h.01M8.5 18.4h3.6M15.5 18.4h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'calcTools':
      return (
        <>
          <rect x="4.5" y="3" width="11.5" height="18" rx="2.4" />
          <rect x="6.5" y="5.5" width="7.5" height="3" rx=".95" fill="currentColor" stroke="none" />
          <path d="M7.8 11.7h.01M10.2 11.7h.01M12.6 11.7h.01M7.8 14.8h.01M10.2 14.8h.01M12.6 14.8h.01M7.8 18h2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m14.6 17.1 4.1-4.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.6 10a1.85 1.85 0 0 0 2.45 2.45l-1.05 1.05-2.45-2.45z" fill="currentColor" stroke="none" />
          <path d="m14.5 17.2-1.55 1.55a1.15 1.15 0 0 0 1.63 1.63l1.55-1.55" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m15.85 12.55 1.15-1.15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'mail':
      return (
        <>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m5 8 7 5 7-5" />
        </>
      );
    case 'chat':
      return (
        <>
          <path d="M6 7.5A3.5 3.5 0 0 1 9.5 4h7A3.5 3.5 0 0 1 20 7.5v4A3.5 3.5 0 0 1 16.5 15H12l-4 4v-4H9.5A3.5 3.5 0 0 1 6 11.5z" />
          <path d="M10 9h6M10 12h4" />
        </>
      );
    case 'poll':
      return <path d="M4 19h16M7 19v-6M12 19V8M17 19v-9" />;
    case 'calendar':
      return (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </>
      );
    case 'mic':
      return (
        <>
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
        </>
      );
    case 'bookmark':
      return <path d="M7 4h10v16l-5-3-5 3z" />;
    case 'install':
      return (
        <>
          <path d="M6 18.5A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5h12A2.5 2.5 0 0 1 20.5 8v8a2.5 2.5 0 0 1-2.5 2.5z" />
          <path d="M12 4.2v8.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m8.8 10.8 3.2 3.2 3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 18h8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'networkNodes':
      return (
        <>
          <rect x="5" y="5" width="4.4" height="4.4" rx="1.1" />
          <rect x="14.6" y="5" width="4.4" height="4.4" rx="1.1" />
          <rect x="9.8" y="14.6" width="4.4" height="4.4" rx="1.1" />
          <path d="M9.2 8.2h5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m7.2 9.4 4.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m16.8 9.4-4.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'worldCup':
      return (
        <>
          <path d="M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6Z" />
          <path d="M12 4.2c2.2 2.2 3.4 4.83 3.4 7.8S14.2 17.6 12 19.8c-2.2-2.2-3.4-4.83-3.4-7.8S9.8 6.4 12 4.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 9.2c2.1.9 4.45 1.35 7 1.35s4.9-.45 7-1.35M5 14.8c2.1-.9 4.45-1.35 7-1.35s4.9.45 7 1.35M12 4.4v15.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'bell':
      return (
        <>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      );
    case 'megaphone':
      return (
        <>
          <path d="M14 8v8l-7-2.5v-3L14 8z" />
          <path d="M14 9h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3M7 13v4a2 2 0 0 0 2 2h1" />
        </>
      );
    case 'warning':
      return (
        <>
          <path d="M12 4 21 19H3z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      );
    case 'folder':
      return (
        <>
          <path d="M3 7.5h6l2 2h10v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 7.5V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1.5" />
        </>
      );
    case 'link':
      return (
        <>
          <path d="M10.5 13.5 13.5 10.5" />
          <path d="M8.2 15.8 6.1 17.9a3 3 0 1 1-4.2-4.2l2.1-2.1a3 3 0 0 1 4.2 0" />
          <path d="M15.8 8.2l2.1-2.1a3 3 0 1 1 4.2 4.2l-2.1 2.1a3 3 0 0 1-4.2 0" />
        </>
      );
    case 'pin':
      return (
        <>
          <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.2" />
        </>
      );
    case 'heart':
      return <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />;
    case 'plus':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </>
      );
    case 'book':
      return (
        <>
          <path d="M4.5 5.5h6a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3h-6z" />
          <path d="M13.5 8.5a3 3 0 0 1 3-3h3v13h-3a3 3 0 0 0-3 3" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
        </>
      );
    case 'taxi':
      return (
        <>
          <path d="M6.2 15.5 7.5 9.8A2.8 2.8 0 0 1 10.2 7.5h3.6a2.8 2.8 0 0 1 2.7 2.3l1.3 5.7" />
          <path d="M5 15.5h14a2 2 0 0 1 2 2v1h-2M3 18.5v-1a2 2 0 0 1 2-2" />
          <path d="M7.5 18.5h.01M16.5 18.5h.01M9 7.5l.6-2h4.8l.6 2" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4-4" />
        </>
      );
    default:
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 12h8" />
        </>
      );
  }
}

export function ServiceMenuIcon({ icon, tone }: Readonly<{ icon: KoudamaIconKey; tone: KoudamaIconTone }>) {
  const glyphTransform = GLYPH_OPTICAL_TRANSFORMS[icon];
  return (
    <IconShell className={`kw-service-menu-icon-source tone-${tone}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <g transform={glyphTransform}>{renderServiceIconGlyph(icon)}</g>
      </svg>
    </IconShell>
  );
}

export function GlyphIcon({ icon }: Readonly<{ icon: KoudamaIconKey }>) {
  const glyphTransform = GLYPH_OPTICAL_TRANSFORMS[icon];
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <g transform={glyphTransform}>{renderServiceIconGlyph(icon)}</g>
    </svg>
  );
}