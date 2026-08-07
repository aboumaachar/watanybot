import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconShell } from '../../components/IconShell';
import { GlyphIcon, ServiceMenuIcon, type KoudamaIconKey as IconKey, type KoudamaIconTone as IconTone } from './KoudamaAgent5Icons';
// APEX_CSS_FREEZE_DISABLED_IMPORT import './KoudamaAgent5Home.css';

type ThemeKey = 'watani' | 'layli' | 'wadih' | 'nahasi' | 'ramli' | 'azraq' | 'arzi' | 'askari';

type CardItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconKey;
  color: IconTone;
  badge?: number;
  children: string[];
  route?: string;
  eventName?: string;
};

type PreviewTile = {
  label: string;
  icon: IconKey;
  tone: IconTone;
};

type LandingPanelState =
  | { kind: 'closed' }
  | { kind: 'group'; item: CardItem };

const childVisuals: Record<string, { icon: IconKey; tone: IconTone }> = {
  'السوق': { icon: 'grid', tone: 'gold' },
  'مزودو الخدمات': { icon: 'home', tone: 'teal' },
  'تاكسي': { icon: 'taxi', tone: 'teal' },
  'الخدمات الحرة': { icon: 'briefcase', tone: 'green' },
  'طلب مساعدة': { icon: 'heart', tone: 'green' },
  'الأخبار': { icon: 'megaphone', tone: 'blue' },
  'التعاميم': { icon: 'document', tone: 'gold' },
  'التنبيهات': { icon: 'bell', tone: 'red' },
  'الوفيات': { icon: 'bell', tone: 'gray' },
  'زائف': { icon: 'warning', tone: 'red' },
  'آخر المستجدات': { icon: 'document', tone: 'blue' },
  'بياناتي': { icon: 'person', tone: 'red' },
  'رسائلي': { icon: 'mail', tone: 'blue' },
  'إعلاناتي وخدماتي': { icon: 'briefcase', tone: 'gold' },
  'طلباتي': { icon: 'document', tone: 'teal' },
  'تذاكري': { icon: 'calendar', tone: 'purple' },
  'المحفوظات': { icon: 'bookmark', tone: 'purple' },
  'تثبيت التطبيق': { icon: 'install', tone: 'teal' },
  'كأس العالم': { icon: 'worldCup', tone: 'gold' },
  'الدردشات': { icon: 'chat', tone: 'blue' },
  'غرف المجتمع': { icon: 'people', tone: 'green' },
  'التصويت': { icon: 'poll', tone: 'purple' },
  'الفعاليات': { icon: 'calendar', tone: 'gold' },
  'الدردشة الصوتية': { icon: 'mic', tone: 'teal' },
  'مشاركاتي': { icon: 'person', tone: 'blue' },
  'المعاملات': { icon: 'document', tone: 'blue' },
  'النماذج': { icon: 'folder', tone: 'purple' },
  'القوانين': { icon: 'book', tone: 'gold' },
  'معاملاتي': { icon: 'document', tone: 'teal' },
  'طلب جديد': { icon: 'plus', tone: 'green' },
  'روابط مفيدة': { icon: 'link', tone: 'blue' },
  'حاسبة المعاش': { icon: 'calculator', tone: 'green' },
  'التعويضات': { icon: 'heart', tone: 'red' },
  'القرارات المرضية': { icon: 'heart', tone: 'red' },
  'المساعدات المدرسية': { icon: 'heart', tone: 'blue' },
  'أداة العنوان': { icon: 'pin', tone: 'teal' },
  'المستندات': { icon: 'folder', tone: 'gray' },
  'كل الخدمات': { icon: 'home', tone: 'gold' },
  'كل الأخبار': { icon: 'megaphone', tone: 'blue' },
  'كل النماذج': { icon: 'folder', tone: 'purple' },
  'كل القوانين': { icon: 'book', tone: 'gold' },
  'كل الطلبات': { icon: 'document', tone: 'teal' },
  'الإعدادات': { icon: 'settings', tone: 'gray' },
};

const themes: Array<{ key: ThemeKey; label: string }> = [
  { key: 'layli', label: 'ليلي' },
  { key: 'watani', label: 'العادي' },
  { key: 'nahasi', label: 'نحاس' },
  { key: 'ramli', label: 'رملي' },
  { key: 'azraq', label: 'أزرق' },
  { key: 'arzi', label: 'أرزي' },
  { key: 'askari', label: 'عسكري' },
];

const groups: CardItem[] = [
  {
    id: 'install-root',
    title: 'تثبيت التطبيق',
    subtitle: 'اختصار على الجهاز',
    icon: 'install',
    color: 'teal',
    children: [],
    eventName: 'watany-open-install-prompt',
  },
  {
    id: 'network',
    title: 'الشبكة',
    subtitle: 'تواصل واتصالات',
    icon: 'networkNodes',
    color: 'blue',
    badge: 7,
    children: ['مزودو الخدمات', 'الخدمات الحرة', 'طلب مساعدة'],
  },
  {
    id: 'updates',
    title: 'التعاميم',
    subtitle: 'قرارات رسمية',
    icon: 'document',
    color: 'purple',
    badge: 5,
    children: ['الأخبار', 'التعاميم', 'التنبيهات', 'الوفيات', 'زائف', 'آخر المستجدات'],
  },
  {
    id: 'profile',
    title: 'ملفي',
    subtitle: 'حسابي وبياناتي',
    icon: 'person',
    color: 'blue',
    badge: 3,
    children: ['بياناتي', 'رسائلي', 'طلباتي', 'تذاكري', 'المحفوظات', 'تثبيت التطبيق'],
  },
  {
    id: 'community',
    title: 'مجتمعي',
    subtitle: 'مجتمع قدامى',
    icon: 'people',
    color: 'pink',
    badge: 4,
    children: ['الدردشات', 'غرف المجتمع', 'الفعاليات', 'الدردشة الصوتية', 'مشاركاتي'],
  },
  {
    id: 'services',
    title: 'خدمات',
    subtitle: 'الخدمات الرسمية',
    icon: 'heart',
    color: 'blue',
    badge: 6,
    children: ['المعاملات', 'النماذج', 'القوانين', 'معاملاتي', 'طلب جديد', 'روابط مفيدة'],
  },
  {
    id: 'tools',
    title: 'ادوات',
    subtitle: 'حاسبات ونماذج',
    icon: 'calcTools',
    color: 'blue',
    badge: 3,
    children: ['حاسبة المعاش', 'القرارات المرضية', 'المساعدات المدرسية', 'أداة العنوان', 'المستندات'],
  },
  {
    id: 'all',
    title: 'يجري الان',
    subtitle: 'آخر المستجدات',
    icon: 'document',
    color: 'red',
    badge: 28,
    children: ['كل الخدمات', 'كل الأخبار', 'كل النماذج', 'كل القوانين', 'كل الطلبات', 'الإعدادات'],
  },
];

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

// (Removed unused preview tile constants and unused icon component)

const profileSheetItems: PreviewTile[] = [
  { label: 'بياناتي', icon: 'person', tone: 'red' },
  { label: 'رسائلي', icon: 'mail', tone: 'blue' },
  { label: 'طلباتي', icon: 'document', tone: 'teal' },
  { label: 'المحفوظات', icon: 'bookmark', tone: 'purple' },
  { label: 'تثبيت التطبيق', icon: 'install', tone: 'teal' },
];

type ProfilePanelKey = 'menu' | 'theme';

const profileItemRoutes: Record<string, string> = {
  'بياناتي': '/settings',
  'رسائلي': '/messages',
  'طلباتي': '/cases',
  'المحفوظات': '/saved',
};

const landingChildRoutes: Record<string, string> = {
  'مزودو الخدمات': '/services/official',
  'الخدمات الحرة': '/freelance-services',
  'طلب مساعدة': '/cases',
  'الأخبار': '/news',
  'التعاميم': '/updates',
  'التنبيهات': '/alerts',
  'الوفيات': '/al-wafiyat',
  'زائف': '/fake-news',
  'آخر المستجدات': '/updates',
  'الدردشات': '/messages',
  'غرف المجتمع': '/groups',
  'الفعاليات': '/community',
  'الدردشة الصوتية': '/chat',
  'مشاركاتي': '/community',
  'المعاملات': '/procedures',
  'النماذج': '/forms',
  'القوانين': '/legal',
  'معاملاتي': '/cases',
  'طلب جديد': '/cases',
  'روابط مفيدة': '/useful-links',
  'حاسبة المعاش': '/salary',
  'القرارات المرضية': '/salary',
  'المساعدات المدرسية': '/school-grants',
  'أداة العنوان': '/dev/address-widget-smoke',
  'المستندات': '/documents',
  'كل الخدمات': '/services/official',
  'كل الأخبار': '/news',
  'كل النماذج': '/forms',
  'كل القوانين': '/legal',
  'كل الطلبات': '/cases',
  'الإعدادات': '/settings',
};

function KoudamaAgent5Home() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeKey>(() => {
    try {
      const saved = globalThis.localStorage.getItem('watany_theme_preference') as ThemeKey | null;
      return saved && themes.some((item) => item.key === saved) ? saved : 'watani';
    } catch {
      return 'watani';
    }
  });
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [activeProfilePanel, setActiveProfilePanel] = useState<ProfilePanelKey>('menu');
  const [landingPanel, setLandingPanel] = useState<LandingPanelState>({ kind: 'closed' });
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    document.documentElement.dataset.theme = theme;
    document.body.classList.add('koudama-agent5-active');
    try {
      globalThis.localStorage.setItem('watany_theme_preference', theme);
    } catch {
      // localStorage may be disabled in private contexts.
    }

    return () => {
      document.body.classList.remove('koudama-agent5-active');
    };
  }, [theme]);

  const openProfileSheet = () => {
    setActiveProfilePanel('menu');
    setThemeSettingsOpen(true);
  };

  const openGroupPanel = (item: CardItem) => {
    setLandingPanel({ kind: 'group', item });
  };

  const closeGroupPanel = () => {
    setLandingPanel({ kind: 'closed' });
  };

  const handleRootCardClick = (item: CardItem) => {
    if (item.id === 'profile') {
      openProfileSheet();
      return;
    }
    if (item.eventName) {
      globalThis.dispatchEvent(new Event(item.eventName));
      return;
    }
    if (item.route) {
      navigate(item.route);
      return;
    }
    openGroupPanel(item);
  };

  return (
    <>
    <main className="kw-agent5-root" aria-label="موطني">
      <section className="kw-card-grid" aria-label="مجموعات موطني الرئيسية">
        {groups.map((item) => (
          <button
            key={item.id}
            data-feature-key={item.id}
            type="button"
            className={`kw-main-card tone-${item.color}`}
            aria-label={item.title}
            aria-expanded={item.id === 'profile' ? themeSettingsOpen : landingPanel.kind === 'group' && landingPanel.item.id === item.id}
            onClick={() => handleRootCardClick(item)}
          >
            <span className="kw-card-icon-wrap">
              {item.badge ? <span className="kw-card-badge">{formatBadgeCount(item.badge)}</span> : null}
              <ServiceMenuIcon icon={item.icon} tone={item.color} />
            </span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </section>

    </main>
    {themeSettingsOpen ? (
      <dialog className="kw-profile-sheet" open aria-label="إعدادات الملف الشخصي">
        <button
          type="button"
          className="kw-profile-sheet__backdrop"
          aria-label="إغلاق إعدادات الملف"
          onClick={() => {
            setThemeSettingsOpen(false);
            setActiveProfilePanel('menu');
          }}
        />
        <section className="kw-profile-settings kw-profile-sheet__panel" aria-label="إعدادات الملف الشخصي">
          <div className="kw-overlay-head kw-profile-sheet__head">
            <div>
              <strong>{activeProfilePanel === 'menu' ? 'إعدادات الملف' : 'إعدادات المظهر'}</strong>
              <span>
                {activeProfilePanel === 'menu'
                  ? 'عناصر الملف الشخصي تظهر هنا، والمظهر واحد من العناصر الفرعية.'
                  : 'اختر مظهر التطبيق من داخل الملف الشخصي.'}
              </span>
            </div>
            <button
              type="button"
              aria-label={activeProfilePanel === 'menu' ? 'إغلاق' : 'رجوع'}
              onClick={() => {
                if (activeProfilePanel === 'theme') {
                  setActiveProfilePanel('menu');
                  return;
                }
                setThemeSettingsOpen(false);
                setActiveProfilePanel('menu');
              }}
            >
              {activeProfilePanel === 'menu' ? '×' : '←'}
            </button>
          </div>

          {activeProfilePanel === 'menu' ? (
            <div className="kw-profile-menu">
              {profileSheetItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="kw-profile-menu__item"
                  onClick={() => {
                    const targetRoute = profileItemRoutes[item.label];
                    if (!targetRoute) {
                      return;
                    }
                    setThemeSettingsOpen(false);
                    setActiveProfilePanel('menu');
                    navigate(targetRoute);
                  }}
                >
                  <IconShell className={`kw-profile-menu__icon tone-${item.tone}`}>
                    <GlyphIcon icon={item.icon} />
                  </IconShell>
                  <span className="kw-profile-menu__label">{item.label}</span>
                </button>
              ))}

              <button
                type="button"
                className="kw-profile-menu__item kw-profile-menu__item--theme"
                onClick={() => setActiveProfilePanel('theme')}
              >
                <IconShell className="kw-profile-menu__icon tone-gray">
                  <GlyphIcon icon="settings" />
                </IconShell>
                <span className="kw-profile-menu__label">المظهر</span>
                <span className={`kw-profile-menu__current kw-swatch ${theme}`} />
              </button>
            </div>
          ) : null}

          <div className={`kw-profile-settings__themes${activeProfilePanel === 'theme' ? '' : ' is-hidden'}`}>
            <div className="kw-theme-grid primary">
              {themes.slice(0, 4).map((item) => (
                <button
                  key={item.key}
                  data-feature-key={item.key}
                  type="button"
                  className={`kw-theme-chip ${theme === item.key ? 'active' : ''}`}
                  onClick={() => setTheme(item.key)}
                  aria-pressed={theme === item.key}
                >
                  <span className={`kw-swatch ${item.key}`} />
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>

            <div className="kw-extra-title">ألوان إضافية</div>

            <div className="kw-theme-grid secondary">
              {themes.slice(4).map((item) => (
                <button
                  key={item.key}
                  data-feature-key={item.key}
                  type="button"
                  className={`kw-theme-chip small ${theme === item.key ? 'active' : ''}`}
                  onClick={() => setTheme(item.key)}
                  aria-pressed={theme === item.key}
                >
                  <span className={`kw-swatch ${item.key}`} />
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </div>

        </section>
      </dialog>
    ) : null}

    {landingPanel.kind === 'group' ? (
      <dialog className="kw-profile-sheet" open aria-label={landingPanel.item.title}>
        <button
          type="button"
          className="kw-profile-sheet__backdrop"
          aria-label="إغلاق القائمة"
          onClick={closeGroupPanel}
        />
        <section className="kw-profile-settings kw-profile-sheet__panel kw-group-sheet" aria-label={landingPanel.item.title}>
          <div className="kw-overlay-head kw-profile-sheet__head">
            <div>
              <strong>{landingPanel.item.title}</strong>
              <span>{landingPanel.item.subtitle}</span>
            </div>
            <button type="button" aria-label="إغلاق" onClick={closeGroupPanel}>×</button>
          </div>

          <div className="kw-child-grid">
            {landingPanel.item.children.map((child) => {
              const visual = childVisuals[child] ?? { icon: landingPanel.item.icon, tone: landingPanel.item.color };
              const targetRoute = landingChildRoutes[child];

              return (
                <button
                  key={child}
                  type="button"
                  className="kw-child-item"
                  onClick={() => {
                    if (!targetRoute) {
                      return;
                    }
                    closeGroupPanel();
                    navigate(targetRoute);
                  }}
                >
                  <ServiceMenuIcon icon={visual.icon} tone={visual.tone} />
                  <strong>{child}</strong>
                </button>
              );
            })}
          </div>
        </section>
      </dialog>
    ) : null}
    </>
  );
}

export default KoudamaAgent5Home;
