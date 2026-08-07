import { useState, type ComponentType, type SVGProps } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import type { Mode } from '../store/app';
import { useNavigateMode } from '../lib/routes';
import { useFeatureFlags } from '../store/features';
import { openAdminApp } from '../lib/admin-app';
import { getTopHeaderEndpointById, resolveTopHeaderHelpEndpoint } from '../lib/menu-endpoint-contract';
import KoudamaFeatureIcon from './koudama-icons/KoudamaFeatureIcon';
import { WatanyV4Icon } from '../theme/watany-v4/WatanyV4Icon';
// APEX_CSS_FREEZE_DISABLED_IMPORT import '../styles/TopMenu.css';

const LOGO_SRC = '/logo.png';

type Props = Readonly<{
  onNavigate?: (mode: Mode) => void;
}>;

function makeTopMenuKoudamaIcon(featureId: string): ComponentType<SVGProps<SVGSVGElement>> {
  function TopMenuKoudamaIcon({ className }: Readonly<SVGProps<SVGSVGElement>>) {
    return <KoudamaFeatureIcon featureId={featureId} size="md" className={className} />;
  }

  return TopMenuKoudamaIcon;
}

export function TopMenu({ onNavigate }: Props) {
  const [showProfile, setShowProfile] = useState(false);
  const { profile, logout } = useApp();
  const { isEnabled } = useFeatureFlags();
  const navigateMode = useNavigateMode();
  const navigate = useNavigate();
  const location = useLocation();
  const canAccessAdmin = profile.role === 'admin' || profile.role === 'superadmin';
  const notificationsEnabled = isEnabled('notifications');
  const faqEnabled = isEnabled('ticker_faq');
  const profileEnabled = isEnabled('profile');

  const handleAuthAction = async () => {
    if (profile.isAuthed) {
      closeAll();
      await logout();
      return;
    }

    navigate('/login');
  };

  const openMainMenu = () => {
    closeAll();
    globalThis.dispatchEvent(new CustomEvent('watany-open-main-menu', {
      detail: { focusActiveGroup: false },
    }));
  };

  const closeAll = () => {
    setShowProfile(false);
  };

  const navigateToMode = (mode: Mode) => {
    closeAll();
    if (onNavigate) {
      onNavigate(mode);
      return;
    }
    navigateMode(mode);
  };

  const profileActions = [
    profileEnabled ? {
      key: 'profile',
      label: 'الحساب والإعدادات',
      endpoint: getTopHeaderEndpointById('profile'),
      desc: 'تحديث البيانات وتفضيلات الاستخدام.',
      icon: makeTopMenuKoudamaIcon('profile'),
      className: '',
      onClick: () => {
        closeAll();
        navigate('/settings');
      },
    } : null,
    notificationsEnabled ? {
      key: 'notifications',
      label: 'الإشعارات',
      endpoint: getTopHeaderEndpointById('notifications'),
      desc: 'مراجعة التنبيهات والإشعارات الحديثة.',
      icon: makeTopMenuKoudamaIcon('notifications'),
      className: '',
      onClick: () => navigateToMode('notifications'),
    } : null,
    faqEnabled ? {
      key: 'faq',
      label: 'الأسئلة الشائعة',
      endpoint: getTopHeaderEndpointById('help'),
      desc: 'الرجوع إلى الإرشادات والأسئلة المتكررة.',
      icon: makeTopMenuKoudamaIcon('faq'),
      className: '',
      onClick: () => navigateToMode('faq'),
    } : null,
    canAccessAdmin ? {
      key: 'admin',
      label: 'لوحة إدارة التطبيق',
      endpoint: '/superadmin',
      desc: 'إدارة الصلاحيات والميزات والإعدادات المركزية.',
      icon: makeTopMenuKoudamaIcon('admin'),
      className: 'tm-profile-card--admin',
      onClick: () => {
        setShowProfile(false);
        try {
          openAdminApp();
        } catch {
          return;
        }
      },
    } : null,
    {
      key: 'help',
      label: 'المساعدة والدعم',
      endpoint: resolveTopHeaderHelpEndpoint(faqEnabled),
      desc: 'الانتقال إلى المساعدة أو متابعة الاستفسار عبر المحادثة.',
      icon: makeTopMenuKoudamaIcon('help'),
      className: '',
      onClick: () => navigateToMode(faqEnabled ? 'faq' : 'chat'),
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    desc: string;
    endpoint: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    className: string;
    onClick: () => void;
  }>;

  return (
    <>
      <header className="top-menu wmo-legacy-nav-review" data-wmo-duplicate-top-nav="true">
        {/* Left: Logo (moved visually to extreme left) with optional inline burger */}
        <div className="menu-logo" aria-label="الشعار">
          <button
            type="button"
            className="menu-logo__burger"
            data-testid="watany-main-menu-toggle"
            title="القائمة"
            onClick={openMainMenu}
            aria-label="القائمة الصغرى"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <KoudamaFeatureIcon featureId="menu" size="sm" />
          </button>

          {location.pathname !== '/login' && (
            <img className="menu-logo__img" src={LOGO_SRC} alt="شعار موطني" loading="eager" decoding="async" />
          )}
        </div>

        {/* Primary burger (kept for backwards compatibility / large hit target) */}
        <button
          type="button"
          className="menu-toggle"
          data-testid="watany-main-menu-toggle"
          title="القائمة"
          data-endpoint={getTopHeaderEndpointById('menu')}
          onClick={openMainMenu}
          aria-label="القائمة"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <KoudamaFeatureIcon featureId="menu" size="md" />
        </button>

        {/* News ticker placed next to logo */}
        <div className="news-ticker" role="region" aria-label="آخر الأخبار">
          <div className="news-ticker__items" aria-hidden="true">
            <span>أحدث الأخبار: إطلاق خدمات جديدة في السوق.</span>
            <span>تذكير: مواعيد صرف الرواتب غداً.</span>
            <span>تحديث الإجراءات: وثائق جديدة متاحة للتحميل.</span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: only login/logout */}
        <div className="menu-actions">
          <button
            type="button"
            className="tm-login-btn"
            onClick={() => { void handleAuthAction(); }}
            title={profile.isAuthed ? "تسجيل الخروج" : "تسجيل الدخول"}
            data-endpoint={profile.isAuthed ? getTopHeaderEndpointById('logout') : getTopHeaderEndpointById('login')}
          >
            <WatanyV4Icon name={profile.isAuthed ? "profile" : "login"} aria-hidden="true" width={18} height={18} />
            <span className="tm-login-text">{profile.isAuthed ? "تسجيل الخروج" : "تسجيل الدخول"}</span>
          </button>
        </div>
      </header>

      {/* ─── Profile Panel ─── (visible when logged in) */}
      {showProfile && profile.isAuthed && (
        <>
          <button
            type="button"
            className="tm-panel-overlay"
            onClick={() => setShowProfile(false)}
            aria-label="إغلاق لوحة الحساب"
          />
          <div className="tm-profile-panel">
            <div className="tm-panel-header">
              <h2>حسابي</h2>
              <button type="button" className="tm-close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <div className="tm-panel-body">
              <div className="tm-profile-info">
                <div className="tm-profile-avatar-large">
                  <WatanyV4Icon name="profile" aria-hidden="true" width={40} height={40} />
                </div>
                <h3 className="tm-profile-name">{profile.name || "مستخدم"}</h3>
                <p className="tm-profile-rank" style={{ textTransform: "capitalize" }}>{profile.role || "مستخدم"}</p>
              </div>
              <div className="tm-profile-menu">
                {profileActions.map((action) => (
                  <button
                    type="button"
                    key={action.key}
                    data-feature-key={action.key}
                    className={`tm-profile-card ${action.className}`.trim()}
                    data-endpoint={action.endpoint}
                    onClick={action.onClick}
                  >
                    <span className="tm-profile-card__icon" aria-hidden="true">
                      {(() => { const ActionIcon = action.icon; return <ActionIcon aria-hidden />; })()}
                    </span>
                    <span className="tm-profile-card__label">{action.label}</span>
                    <span className="tm-profile-card__desc">{action.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="tm-panel-footer">
              <button type="button" className="tm-logout-btn" onClick={async () => { setShowProfile(false); await logout(); }}>
                <KoudamaFeatureIcon featureId="logout" size="sm" /> تسجيل الخروج
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
// APEX_PHASE4D_NAV_DUPLICATE_REVIEW: verify whether this component is still needed under WatanyMobileShell.

