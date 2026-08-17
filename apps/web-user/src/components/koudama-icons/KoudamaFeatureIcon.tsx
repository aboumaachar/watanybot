import type { CSSProperties, ReactNode } from 'react';
import { getKoudamaIconAssignment, type KoudamaIconName } from '../../config/koudamaIconAssignments.generated';
import './koudamaFeatureIcon.css';

export type KoudamaFeatureIconProps = {
  featureId?: string | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  renderMode?: 'outline' | 'filled';
};

type FilledGlyph = {
  viewBox?: string;
  body: string[];
  detail?: string[];
};

const OUTLINE_ICON_ALIAS: Record<string, string> = {
  home: 'Home',
  shortcut: 'LayoutGrid',
  assistant: 'BotMessageSquare',
  search: 'Search',
  questions: 'LifeBuoy',
  deaths: 'Bell',
  news: 'Newspaper',
  fake_alerts: 'TriangleAlert',
  procedures: 'FilePenLine',
  services: 'LayoutGrid',
  documents: 'FileText',
  forms: 'ReceiptText',
  assistance: 'HandsHeart',
  market: 'Store',
  volunteering: 'HandsHeart',
  jobs: 'BriefcaseBusiness',
  taxi: 'Car',
  phone: 'Phone',
  support: 'LifeBuoy',
  payment: 'CircleDollarSign',
  calculator: 'Calculator',
  laws: 'Gavel',
  admin: 'ShieldCheck',
  install: 'Download',
  fullscreen: 'LayoutGrid',
  logout: 'LogIn',
  theme_system: 'LayoutGrid',
  theme_light: 'CircleHelp',
  theme_dark: 'CircleHelp',
  theme_contrast: 'CircleHelp',
};

const FILLED_TOKEN_ALIAS: Record<string, string> = {
  main: 'home',
  home: 'home',
  shortcut: 'shortcut',
  pin: 'shortcut',
  pinned: 'shortcut',
  chat: 'assistant',
  profile: 'home',
  account: 'home',
  global_search: 'search',
  search: 'search',
  help: 'questions',
  faq: 'questions',
  questions: 'questions',
  circlehelp: 'questions',
  lifebuoy: 'questions',
  notifications: 'deaths',
  alerts_notifications: 'deaths',
  deaths: 'deaths',
  bell: 'deaths',
  news: 'news',
  newspaper: 'news',
  fake_alerts: 'fake_alerts',
  trianglealert: 'fake_alerts',
  procedures: 'procedures',
  procedure: 'procedures',
  filepenline: 'procedures',
  services: 'services',
  my_listings_services: 'services',
  documents: 'documents',
  cases: 'documents',
  filetext: 'documents',
  forms: 'forms',
  receipttext: 'forms',
  requests: 'forms',
  assistance: 'assistance',
  assistance_request: 'assistance',
  school_grants: 'assistance',
  handsheart: 'assistance',
  market: 'market',
  marketplace: 'market',
  store: 'market',
  volunteering: 'volunteering',
  jobs: 'jobs',
  civilian_jobs: 'jobs',
  briefcasebusiness: 'jobs',
  taxi: 'taxi',
  car: 'taxi',
  phone: 'phone',
  call: 'phone',
  support: 'support',
  payment: 'payment',
  pension: 'payment',
  salary_statement: 'payment',
  circledollarsign: 'payment',
  pension_calculator: 'calculator',
  calculator: 'calculator',
  laws: 'laws',
  legal: 'laws',
  bookmarks: 'laws',
  gavel: 'laws',
  admin: 'admin',
  superadmin: 'admin',
  shieldcheck: 'admin',
  install: 'install',
  downloads: 'install',
  download: 'install',
  install_watany_app: 'install',
  fullscreen: 'fullscreen',
  maximize: 'fullscreen',
  immersive: 'fullscreen',
  alerts: 'fake_alerts',
  saved: 'documents',
  logout: 'logout',
  signout24regular: 'logout',
  botmessagesquare: 'assistant',
  messagecircle: 'assistant',
  messagessquare: 'assistant',
  theme_system: 'theme_system',
  theme_light: 'theme_light',
  theme_dark: 'theme_dark',
  theme_contrast: 'theme_contrast',
};

const SEMANTIC_FALLBACK_COLORS: Record<string, { sign: string; contour: string; tile: string }> = {
  services: { sign: '#1677D2', contour: '#1677D2', tile: '#FFFFFF' },
  money: { sign: '#0B8F45', contour: '#0B8F45', tile: '#FFFFFF' },
  account: { sign: '#7B3FE4', contour: '#7B3FE4', tile: '#FFFFFF' },
  global: { sign: '#E43E6A', contour: '#E43E6A', tile: '#FFFFFF' },
  notifications: { sign: '#E43E4E', contour: '#E43E4E', tile: '#FFFFFF' },
  entertainment: { sign: '#C89220', contour: '#C89220', tile: '#FFFFFF' },
  procedures: { sign: '#B9892D', contour: '#B9892D', tile: '#FFFFFF' },
  brand: { sign: '#0B7F3A', contour: '#0B7F3A', tile: '#FFFFFF' },
  help: { sign: '#E43E6A', contour: '#E43E6A', tile: '#FFFFFF' },
  network: { sign: '#0B8F45', contour: '#0B8F45', tile: '#FFFFFF' },
  default: { sign: '#1677D2', contour: '#1677D2', tile: '#FFFFFF' },
};

const FILLED_GLYPHS: Record<string, FilledGlyph> = {
  home: {
    body: [
      'M3.3 11.1 12 3.7l8.7 7.4c.45.38.5 1.05.12 1.5-.38.45-1.05.5-1.5.12L18.4 12v7.2A1.8 1.8 0 0 1 16.6 21H14v-5.5a2 2 0 0 0-4 0V21H7.4a1.8 1.8 0 0 1-1.8-1.8V12l-.92.78c-.45.38-1.12.33-1.5-.12-.38-.45-.33-1.12.12-1.5Z',
    ],
    detail: ['M10 20.9v-5.4a2 2 0 0 1 4 0v5.4'],
  },
  theme_system: {
    body: ['M5.2 4.6h13.6A2.6 2.6 0 0 1 21.4 7.2v8.4a2.6 2.6 0 0 1-2.6 2.6h-4.5l1.1 1.7c.2.31-.02.71-.39.71H9.05c-.37 0-.59-.4-.39-.71l1.1-1.7h-4.56a2.6 2.6 0 0 1-2.6-2.6V7.2a2.6 2.6 0 0 1 2.6-2.6Z'],
    detail: ['M5.6 7.7h12.8v7.2H5.6z'],
  },
  theme_light: {
    body: ['M12 4.1a.9.9 0 0 1 .9.9v1.3a.9.9 0 1 1-1.8 0V5a.9.9 0 0 1 .9-.9Zm0 12.3a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Zm7-5.3a.9.9 0 0 1 .9.9.9.9 0 0 1-.9.9h-1.3a.9.9 0 1 1 0-1.8H19ZM6.3 12a.9.9 0 0 1-.9.9H4.1a.9.9 0 1 1 0-1.8h1.3a.9.9 0 0 1 .9.9Zm9.76-4.86a.9.9 0 0 1 1.27 0l.92.92a.9.9 0 1 1-1.27 1.27l-.92-.92a.9.9 0 0 1 0-1.27Zm-9.42 9.42a.9.9 0 0 1 1.27 0l.92.92a.9.9 0 1 1-1.27 1.27l-.92-.92a.9.9 0 0 1 0-1.27Zm10.34.92.92-.92a.9.9 0 1 1 1.27 1.27l-.92.92a.9.9 0 1 1-1.27-1.27ZM7.94 7.14a.9.9 0 0 1 0 1.27l-.92.92A.9.9 0 0 1 5.75 8.06l.92-.92a.9.9 0 0 1 1.27 0Z'],
  },
  theme_dark: {
    body: ['M14.95 4.8a7.25 7.25 0 1 0 4.25 13.14.55.55 0 0 0-.28-1 5.5 5.5 0 0 1-6.07-8.1.55.55 0 0 0-.5-.82 7.3 7.3 0 0 0 2.6-3.22Z'],
  },
  theme_contrast: {
    body: ['M12 3.7a8.3 8.3 0 1 1 0 16.6 8.3 8.3 0 0 1 0-16.6Z', 'M12 4.7v14.6a7.3 7.3 0 0 0 0-14.6Z'],
    detail: ['M12 4.7v14.6'],
  },
  assistant: {
    body: [
      'M12 3.6c.64 0 1.15.51 1.15 1.15v1.08h2.65A4.2 4.2 0 0 1 20 10v4.2a4.2 4.2 0 0 1-4.2 4.2h-.15l1.35 1.35a1.05 1.05 0 0 1-1.48 1.48L12.72 18.4h-1.44l-2.8 2.83A1.05 1.05 0 1 1 7 19.75l1.35-1.35H8.2A4.2 4.2 0 0 1 4 14.2V10a4.2 4.2 0 0 1 4.2-4.17h2.65V4.75c0-.64.51-1.15 1.15-1.15Z',
    ],
    detail: ['M8.6 12.05h.03M15.4 12.05h.03M9.4 15.05h5.2'],
  },
  services: {
    body: ['M4.1 7.2A2.2 2.2 0 0 1 6.3 5h4.15c.64 0 1.24.3 1.62.82l1.04 1.38h4.58A2.3 2.3 0 0 1 20 9.5v7.1a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 16.6V7.2h.1Z'],
    detail: ['M5.2 9.3h13.6'],
  },
  documents: {
    body: [
      'M7 3.5h6.7c.45 0 .88.18 1.2.5L18.5 7.6c.32.32.5.75.5 1.2v9.7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z',
      'M13.4 3.8v4.1c0 .55.45 1 1 1h4.1',
    ],
    detail: ['M8.5 12h7M8.5 15h7M8.5 18h4.5'],
  },
  questions: {
    body: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z'],
    detail: ['M9.45 9.15c.38-1.45 1.56-2.25 3.03-2.05 1.45.2 2.45 1.17 2.45 2.55 0 1.78-2.22 2.05-2.65 3.35M12 16.8h.02'],
  },
  procedures: {
    body: [
      'M7 3.5h7.2c.44 0 .86.18 1.18.49l3.13 3.13c.31.32.49.74.49 1.18v10.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z',
      'M14 3.8v3.8c0 .55.45 1 1 1h3.8',
    ],
    detail: ['M8.5 11h7M8.5 14.3h7M8.5 17.6h5'],
  },
  forms: {
    body: ['M8 4.6h2.1a2.1 2.1 0 0 1 3.8 0H16A2.1 2.1 0 0 1 18.1 6.7v11.2A2.1 2.1 0 0 1 16 20H8a2.1 2.1 0 0 1-2.1-2.1V6.7A2.1 2.1 0 0 1 8 4.6Z'],
    detail: ['M9.2 11.9 11 13.7l3.9-4.2M9.1 17h5.8M10.1 6.7h3.8'],
  },
  fake_alerts: {
    body: ['M10.35 4.15c.73-1.28 2.57-1.28 3.3 0l7.25 12.7A1.9 1.9 0 0 1 19.25 19.7H4.75a1.9 1.9 0 0 1-1.65-2.85l7.25-12.7Z'],
    detail: ['M12 8.1v5.4M12 16.9h.02'],
  },
  news: {
    body: ['M18.7 5.9c.7-.38 1.55.13 1.55.93v10.34c0 .8-.85 1.31-1.55.93l-4.35-2.36v.2A2.05 2.05 0 0 1 12.3 18H5.75A2.05 2.05 0 0 1 3.7 15.95v-7.9A2.05 2.05 0 0 1 5.75 6H12.3c1.13 0 2.05.92 2.05 2.05v.21L18.7 5.9Z'],
    detail: ['M6.4 10.1h5M6.4 13.2h4.2'],
  },
  deaths: {
    body: ['M12 4.3a5.6 5.6 0 0 1 5.6 5.6v5.4l1.4 2H5l1.4-2V9.9A5.6 5.6 0 0 1 12 4.3Z', 'M9.7 18.3h4.6c-.25 1.05-1.18 1.8-2.3 1.8s-2.05-.75-2.3-1.8Z'],
  },
  assistance: {
    body: ['M12 20.1 5.25 13.9a4.05 4.05 0 0 1 5.45-6l1.3 1.08 1.3-1.08a4.05 4.05 0 0 1 5.45 6L12 20.1Z', 'M4.1 14.3c1.75.7 3.1 2 4.05 3.9l-1.9.95c-.72-1.45-1.65-2.35-2.95-2.85l.8-2Z', 'M19.9 14.3c-1.75.7-3.1 2-4.05 3.9l1.9.95c.72-1.45 1.65-2.35 2.95-2.85l-.8-2Z'],
  },
  market: {
    body: ['M5 9.4h14l-1.1 9.1A2.2 2.2 0 0 1 15.72 20H8.28a2.2 2.2 0 0 1-2.18-1.5L5 9.4Z', 'M7.1 9.4 8.25 5.9c.27-.83 1.04-1.4 1.92-1.4h3.66c.88 0 1.65.57 1.92 1.4l1.15 3.5H7.1Z'],
    detail: ['M9.2 12.4v3.5M12 12.4v3.5M14.8 12.4v3.5'],
  },
  volunteering: {
    body: ['M6.2 10.6a3.9 3.9 0 0 1 7.25-2.02 3.9 3.9 0 0 1 6.3 4.35c-.72 2.8-3.9 4.72-7.75 7.02-3.85-2.3-7.03-4.22-7.75-7.02a3.85 3.85 0 0 1 1.95-2.33Z'],
    detail: ['M5.8 13h3.2l1.7 2.7 2.6-6.5 1.8 3.8h3.2'],
  },
  jobs: {
    body: ['M8.5 6.1V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.1h2.75A2.75 2.75 0 0 1 21 8.85v8.4A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25v-8.4A2.75 2.75 0 0 1 5.75 6.1H8.5Z'],
    detail: ['M10.4 6.1V5.2h3.2v.9M3.5 11.4h17M10 11.4v2.2h4v-2.2'],
  },
  taxi: {
    body: ['M6.1 15.5 7.5 9.6A3.1 3.1 0 0 1 10.5 7h3A3.1 3.1 0 0 1 16.5 9.6l1.4 5.9h.15c.83 0 1.5.67 1.5 1.5v1.25c0 .69-.56 1.25-1.25 1.25h-1.05a1.7 1.7 0 0 1-3.4 0h-3.7a1.7 1.7 0 0 1-3.4 0H5.7c-.69 0-1.25-.56-1.25-1.25V17c0-.83.67-1.5 1.5-1.5h.15Z', 'M9 7l.7-2h4.6l.7 2H9Z'],
    detail: ['M7.8 13h8.4M8 17.2h.02M16 17.2h.02'],
  },
  phone: {
    body: ['M7.45 3.65 10 8.1c.34.6.19 1.36-.35 1.78l-1.15.9c1.12 2.1 2.62 3.62 4.72 4.74l.9-1.15c.42-.54 1.18-.69 1.78-.35l4.45 2.55c.7.4.93 1.3.5 1.98l-.95 1.52c-.45.72-1.3 1.07-2.13.86C10.72 19.15 4.85 13.28 3.07 6.23c-.21-.83.14-1.68.86-2.13l1.52-.95c.68-.43 1.58-.2 2 .5Z'],
  },
  support: {
    body: ['M12 3.6a8 8 0 0 1 8 8v3.8a3 3 0 0 1-3 3h-1.8v-7.2H20a8 8 0 0 0-16 0h4.8v7.2H7a3 3 0 0 1-3-3v-3.8a8 8 0 0 1 8-8Z', 'M13 20.4h2.5a2.8 2.8 0 0 0 2.8-2.8h-2.1c0 .39-.31.7-.7.7H13v2.1Z'],
  },
  payment: {
    body: ['M5.5 6h13A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6Z'],
    detail: ['M3.5 10h17M6.5 14.8h6'],
  },
  search: {
    body: ['M10.7 4a6.7 6.7 0 0 1 5.28 10.83l4.12 4.12a1.25 1.25 0 0 1-1.77 1.77l-4.12-4.12A6.7 6.7 0 1 1 10.7 4Zm0 2.5a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z'],
  },
  calculator: {
    body: ['M8 3.5h8A2.5 2.5 0 0 1 18.5 6v12A2.5 2.5 0 0 1 16 20.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5Z'],
    detail: ['M8.4 7.4h7.2M8.9 11h.02M12 11h.02M15.1 11h.02M8.9 14.5h.02M12 14.5h.02M15.1 14.5h.02M8.9 17.5h.02M12 17.5h.02M15.1 17.5h.02'],
  },
  laws: {
    body: ['M10.8 4.1a1.2 1.2 0 0 1 2.4 0v1h5.55a1.15 1.15 0 0 1 0 2.3H17l3.05 5.4c.25.45.2.98-.12 1.38A4.7 4.7 0 0 1 12.4 8.8l.2-.35h-1.2l.2.35a4.7 4.7 0 0 1-7.53 5.38 1.2 1.2 0 0 1-.12-1.38L7 7.4H5.25a1.15 1.15 0 0 1 0-2.3h5.55v-1Z', 'M8.3 18h7.4c.72 0 1.3.58 1.3 1.3 0 .66-.54 1.2-1.2 1.2H8.2c-.66 0-1.2-.54-1.2-1.2 0-.72.58-1.3 1.3-1.3Z'],
    detail: ['M6.2 13.1h4.6M13.2 13.1h4.6'],
  },
  admin: {
    body: ['M12 3 20 6.4v5.4c0 4.9-3.16 7.95-8 9.7-4.84-1.75-8-4.8-8-9.7V6.4L12 3Z'],
    detail: ['M8.4 12.2 10.6 14.4 15.7 9.2'],
  },
  logout: {
    body: ['M5.8 4h5.5A1.8 1.8 0 0 1 13.1 5.8v2.4h-2.3V6.3H6.3v11.4h4.5v-1.9h2.3v2.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V5.8A1.8 1.8 0 0 1 5.8 4Z', 'M15.1 7.2 20 12l-4.9 4.8v-3.1H9.8v-3.4h5.3V7.2Z'],
  },
  shortcut: {
    body: ['M12.2 3.5a1 1 0 0 1 .9.56l1.15 2.33 2.57.38a1 1 0 0 1 .55 1.7l-1.86 1.82.44 2.57a1 1 0 0 1-1.45 1.05L12.2 12.7l-2.3 1.2a1 1 0 0 1-1.45-1.05l.44-2.57-1.86-1.82a1 1 0 0 1 .55-1.7l2.57-.38 1.15-2.33a1 1 0 0 1 .9-.56Z', 'M12 10.1a3.9 3.9 0 0 1 3.9 3.9c0 2.76-3.9 6.5-3.9 6.5S8.1 16.76 8.1 14a3.9 3.9 0 0 1 3.9-3.9Z'],
    detail: ['M12 12.45a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z'],
  },
  install: {
    body: ['M6 18.4A2.4 2.4 0 0 1 3.6 16V8A2.4 2.4 0 0 1 6 5.6h12A2.4 2.4 0 0 1 20.4 8v8a2.4 2.4 0 0 1-2.4 2.4H6Z', 'M12 4a1 1 0 0 1 1 1v6.55l2.1-2.1a1 1 0 1 1 1.4 1.42l-3.8 3.78a1 1 0 0 1-1.4 0L7.5 10.87a1 1 0 0 1 1.4-1.42l2.1 2.1V5a1 1 0 0 1 1-1Z'],
    detail: ['M7.8 18.4h8.4'],
  },
  fullscreen: {
    body: ['M5.9 3.9h3a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm9.2 0h3a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2ZM4.9 15.1a1 1 0 0 1 2 0v2h2a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1v-3Zm13.2 0a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z'],
    detail: ['M9.2 9.2h5.6v5.6H9.2z'],
  },
  default: {
    body: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
    detail: ['M8 9h8M8 12.5h8M8 16h5'],
  },
};

function normalizeFilledToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9_\-/]+/g, '_');
}

function resolveFilledToken(featureId?: string | null, iconKey?: string | null, iconName?: string | null): string | null {
  const candidates = [featureId, iconKey, iconName].map(normalizeFilledToken).filter(Boolean);

  for (const candidate of candidates) {
    const tail = candidate.split('/').filter(Boolean).slice(-1)[0] ?? '';
    const direct = FILLED_TOKEN_ALIAS[candidate] || FILLED_TOKEN_ALIAS[tail];
    if (direct) {
      return direct;
    }
  }

  return null;
}

function IconGlyph({
  name,
  featureId,
  iconKey,
  preferFilled = true,
}: Readonly<{
  name: KoudamaIconName;
  featureId?: string | null;
  iconKey?: string | null;
  preferFilled?: boolean;
}>) {
  const semanticToken = resolveFilledToken(featureId, iconKey, name);
  const filledToken = preferFilled ? semanticToken : null;
  const filledGlyph = filledToken ? FILLED_GLYPHS[filledToken] : undefined;

  if (filledGlyph) {
    return (
      <svg viewBox={filledGlyph.viewBox ?? '0 0 24 24'} aria-hidden="true" className="koudama-feature-icon__svg">
        {filledGlyph.body.map((pathData) => (
          <path key={`body-${pathData}`} className="kfi-fill" d={pathData} />
        ))}
        {filledGlyph.detail?.map((pathData) => (
          <path key={`detail-${pathData}`} className="kfi-detail" d={pathData} />
        ))}
      </svg>
    );
  }

  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const outlineName = semanticToken ? OUTLINE_ICON_ALIAS[semanticToken] ?? name : name;

  let glyph: ReactNode;
  switch (outlineName) {
    case 'Home':
      glyph = <><path {...common} d="M3.5 11.5 12 4l8.5 7.5" /><path {...common} d="M5.5 10.8V20h13v-9.2" /><path {...common} d="M9.5 20v-6h5v6" /></>;
      break;
    case 'UsersRound':
      glyph = <><path {...common} d="M16 11a4 4 0 1 0-8 0" /><path {...common} d="M5 20a7 7 0 0 1 14 0" /><path {...common} d="M20.5 18a4.8 4.8 0 0 0-3.1-4.1" /><path {...common} d="M3.5 18a4.8 4.8 0 0 1 3.1-4.1" /></>;
      break;
    case 'UserRound':
      glyph = <><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M5 20a7 7 0 0 1 14 0" /></>;
      break;
    case 'LayoutGrid':
      glyph = <><rect {...common} x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>;
      break;
    case 'FileText':
    case 'Newspaper':
    case 'ReceiptText':
    case 'FilePenLine':
      glyph = <><path {...common} d="M6 3.8h8.5L18 7.4V20H6z" /><path {...common} d="M14.5 3.8v4H18" /><path {...common} d="M8.5 11h7" /><path {...common} d="M8.5 14.5h7" /><path {...common} d="M8.5 18h4" /></>;
      break;
    case 'Calculator':
      glyph = <><rect {...common} x="6" y="3.5" width="12" height="17" rx="2" /><path {...common} d="M8.5 7h7" /><path {...common} d="M9 11h.1M12 11h.1M15 11h.1M9 14h.1M12 14h.1M15 14h.1M9 17h.1M12 17h.1M15 17h.1" /></>;
      break;
    case 'BotMessageSquare':
    case 'MessageCircle':
    case 'MessagesSquare':
      glyph = <><path {...common} d="M5 7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H10l-5 4z" /><path {...common} d="M9 9.5h.1M12 9.5h.1M15 9.5h.1" /></>;
      break;
    case 'Bell':
      glyph = <><path {...common} d="M18 10a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path {...common} d="M10 20a2 2 0 0 0 4 0" /></>;
      break;
    case 'LogIn':
      glyph = <><path {...common} d="M13.5 4.5H7.8A1.8 1.8 0 0 0 6 6.3v11.4a1.8 1.8 0 0 0 1.8 1.8h5.7" /><path {...common} d="M12 12h8" /><path {...common} d="m17 7 3.5 5L17 17" /></>;
      break;
    case 'List':
      glyph = <><path {...common} d="M8.5 6.8h10" /><path {...common} d="M8.5 12h10" /><path {...common} d="M8.5 17.2h10" /><circle {...common} cx="5.2" cy="6.8" r=".7" /><circle {...common} cx="5.2" cy="12" r=".7" /><circle {...common} cx="5.2" cy="17.2" r=".7" /></>;
      break;
    case 'Search':
      glyph = <><circle {...common} cx="10.5" cy="10.5" r="6.5" /><path {...common} d="m16 16 4.5 4.5" /></>;
      break;
    case 'Phone':
      glyph = <><path {...common} d="M7.8 4.8 10 8.6c.3.52.17 1.18-.31 1.56l-1.08.84c1.05 1.84 2.38 3.17 4.22 4.22l.84-1.08c.38-.48 1.04-.61 1.56-.31l3.8 2.2c.62.36.82 1.16.45 1.76l-.81 1.28c-.4.63-1.14.94-1.86.76C10.9 18.77 5.23 13.1 3.95 7.36c-.18-.72.13-1.46.76-1.86l1.28-.81c.6-.37 1.4-.17 1.76.45Z" /></>;
      break;
    case 'Download':
      glyph = <><path {...common} d="M12 4.5v10" /><path {...common} d="m8.5 11 3.5 3.5 3.5-3.5" /><path {...common} d="M5.5 18.5h13" /></>;
      break;
    case 'MoreHorizontalCircle':
      glyph = <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M8.5 12h.1M12 12h.1M15.5 12h.1" /></>;
      break;
    case 'CircleHelp':
      glyph = <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M9.7 9a2.5 2.5 0 0 1 4.7 1.3c0 1.9-2.4 2.1-2.4 4" /><path {...common} d="M12 17.5h.1" /></>;
      break;
    case 'LifeBuoy':
      glyph = <><circle {...common} cx="12" cy="12" r="8.5" /><circle {...common} cx="12" cy="12" r="3.2" /><path {...common} d="m5.9 5.9 3.8 3.8M18.1 5.9l-3.8 3.8M5.9 18.1l3.8-3.8M18.1 18.1l-3.8-3.8" /></>;
      break;
    case 'GraduationCap':
      glyph = <><path {...common} d="m3 8.5 9-4 9 4-9 4z" /><path {...common} d="M7 11v4c2.8 2 7.2 2 10 0v-4" /><path {...common} d="M21 8.5v5" /></>;
      break;
    case 'HandCoins':
    case 'HandsHeart':
    case 'CircleDollarSign':
      glyph = <><path {...common} d="M5 14.5h4l3 2.5h4.5a2 2 0 0 0 2-2" /><path {...common} d="M3.5 12.5 7 16" /><circle {...common} cx="15" cy="8" r="3.2" /><path {...common} d="M15 6.3v3.4M13.6 8h2.8" /></>;
      break;
    case 'Gavel':
      glyph = <><path {...common} d="m14 5 5 5" /><path {...common} d="m12 7 5 5" /><path {...common} d="m5 18 7-7" /><path {...common} d="M4 21h9" /></>;
      break;
    case 'Megaphone':
      glyph = <><path {...common} d="M4 13h3l9 4V5L7 9H4z" /><path {...common} d="M7 13v5" /><path {...common} d="M19 9.5v3" /></>;
      break;
    case 'TriangleAlert':
      glyph = <><path {...common} d="M12 4 3 20h18z" /><path {...common} d="M12 9v5" /><path {...common} d="M12 17h.1" /></>;
      break;
    case 'BriefcaseBusiness':
      glyph = <><rect {...common} x="4" y="7" width="16" height="12" rx="2" /><path {...common} d="M9 7V5h6v2" /><path {...common} d="M4 12h16" /></>;
      break;
    case 'ShieldCheck':
      glyph = <><path {...common} d="M12 3 19 6v5c0 5-3.4 8-7 10-3.6-2-7-5-7-10V6z" /><path {...common} d="m8.5 12 2.2 2.2 4.8-5" /></>;
      break;
    case 'Store':
      glyph = <><path {...common} d="M4 10h16l-1.3-5.5H5.3z" /><path {...common} d="M6 10v10h12V10" /><path {...common} d="M9 20v-5h6v5" /></>;
      break;
    case 'Car':
      glyph = <><path {...common} d="M5 13 7 7h10l2 6" /><path {...common} d="M4 13h16v5H4z" /><path {...common} d="M7 18v2M17 18v2" /><path {...common} d="M7.5 15.5h.1M16.5 15.5h.1" /></>;
      break;
    case 'MapPinned':
      glyph = <><path {...common} d="M5 6 10 4l4 2 5-2v14l-5 2-4-2-5 2z" /><path {...common} d="M10 4v14M14 6v14" /><path {...common} d="M18 8c0 2.5-3 5-3 5s-3-2.5-3-5a3 3 0 0 1 6 0z" /></>;
      break;
    case 'Trophy':
      glyph = <><path {...common} d="M8 4h8v4a4 4 0 1 1-8 0z" /><path {...common} d="M8 6H5a3 3 0 0 0 3 4" /><path {...common} d="M16 6h3a3 3 0 0 1-3 4" /><path {...common} d="M12 14v4M8.5 20h7" /></>;
      break;
    case 'CedarTreeFull':
      glyph = <path {...common} d="M12 3 7.5 8.5h2.6L6 13.5h3.7L5 19h14l-4.7-5.5H18l-4.1-5H16.5z" />;
      break;
    default:
      glyph = <><rect {...common} x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect {...common} x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>;
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="koudama-feature-icon__svg">
      {glyph}
    </svg>
  );
}

export function KoudamaFeatureIcon({
  featureId,
  label,
  size = 'md',
  className = '',
  renderMode = 'outline',
}: Readonly<KoudamaFeatureIconProps>) {
  const assignment = getKoudamaIconAssignment(featureId);
  const semanticKey = normalizeFilledToken(assignment.iconSemanticKey || featureId || 'services');
  const fallbackPalette = SEMANTIC_FALLBACK_COLORS[semanticKey] ?? SEMANTIC_FALLBACK_COLORS.default;
  const prefersFilledGlyphs = renderMode === 'filled';
  const signColor = assignment.signColor || fallbackPalette.sign;
  const contourColor = assignment.contourColor || fallbackPalette.contour;
  const tileBackground = assignment.tileBackground || fallbackPalette.tile;
  const fallbackLabel = assignment.labelAr || featureId || 'خدمة';
  const style = {
    '--koudama-icon-sign': signColor,
    '--koudama-icon-contour': contourColor,
    '--koudama-icon-tile': tileBackground,
  } as CSSProperties & Record<string, string>;

  return (
    <span
      className={`koudama-feature-icon koudama-feature-icon--${size} ${className}`}
      style={style}
      title={label ?? fallbackLabel}
      data-koudama-feature-id={assignment.featureId}
      data-koudama-icon-key={assignment.iconSemanticKey}
      data-koudama-icon-name={assignment.iconName}
      data-koudama-icon-render={renderMode}
    >
      <span className="koudama-feature-icon__tile" aria-hidden="true">
        <span className="koudama-feature-icon__mist" />
        <IconGlyph
          name={assignment.iconName}
          featureId={assignment.featureId}
          iconKey={assignment.iconSemanticKey}
          preferFilled={prefersFilledGlyphs}
        />
      </span>
    </span>
  );
}

export default KoudamaFeatureIcon;
