import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { WatanyPublicShellV20 } from "./layouts/WatanyPublicShellV20";
import { UnavailableRecoveryPage } from "../pages/WatanyRecoveryPages";
import RegisterPage from "../pages/RegisterPage";
import WatanyV4Homepage from "./WatanyV4Homepage";
import WatanyGuidedSmokePage from "../pages/WatanyGuidedHelperSmokePage";
import WatanyV4FeatureLanding from "./WatanyV4FeatureLanding";
import { SmartAttentionFeaturePage } from "../features/smart-attention-native/SmartAttentionPages";
import { useApp } from "../store/app";
import { isLoggedIn } from "../lib/auth";
import "../apex/apex-theme-runtime-v274";

const LoginPage = lazy(() => import("../pages/LoginPage"));
const SalaryPage = lazy(() => import("../pages/SalaryPage"));
const ProceduresPage = lazy(() => import("../pages/ProceduresPage"));
const SchoolGrantsPage = lazy(() => import("../pages/SchoolGrantsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const SavedChatsPage = lazy(() => import("../pages/SavedChatsPage"));
const BookmarksPage = lazy(() => import("../pages/BookmarksPage"));
const ChatSessionsPage = lazy(() => import("../pages/ChatSessionsPage"));
const JobsPage = lazy(() => import("../pages/JobsPage"));
const AinElHafehJobsPage = lazy(() => import("../pages/AinElHafehJobsPage"));
const AinElHafehAcceptedApplicationsPage = lazy(() => import("../pages/AinElHafehAcceptedApplicationsPage"));
const AinElHafehApplicationsAdminPage = lazy(() => import("../pages/AinElHafehApplicationsAdminPage"));
const MarketPage = lazy(() => import("../pages/MarketPage"));
const SuperAdminPage = lazy(() => import("../pages/SuperAdminPage"));
const SuperadminUsersPage = lazy(() => import("../features/superadmin-users/SuperadminUsersPage"));
const MobileOsChatPage = lazy(() => import("../pages/MobileOsChatPage"));
const HybridKbChatPage = lazy(() => import("../pages/hybrid-kb-chat"));
const DocumentsPage = lazy(() => import("../pages/DocumentsPage"));
const LegalPage = lazy(() => import("../pages/LegalPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const NotificationsPage = lazy(() => import("../pages/NotificationsPage"));
const NewsPage = lazy(() => import("../pages/NewsPage"));
const FakeFactPage = lazy(() => import("../pages/FakeNewsPage"));
const FormsPage = lazy(() => import("../pages/FormsPage"));
const SurveyDetailPage = lazy(() => import("../pages/SurveyDetailPage"));
const SurveyResultsPage = lazy(() => import("../pages/SurveyResultsPage"));
const SurveyPage = lazy(() => import("../pages/SurveyPage"));
const FaqPage = lazy(() => import("../pages/FaqPage"));
const DeathsPage = lazy(() => import("../pages/DeathsPage"));
const CommunityPage = lazy(() => import("../pages/CommunityPage"));
const CommunityThreadsPage = lazy(() => import("../pages/CommunityThreadsPage"));
const TaxiPage = lazy(() => import("../pages/TaxiPage"));
const NetworkPage = lazy(() => import("../pages/NetworkPage"));
const CircularsPage = lazy(() => import("../pages/CircularsPage"));
const ChildrenHubPage = lazy(() => import("../pages/ChildrenHubPage"));
const AdsPage = lazy(() => import("../pages/AdsPage"));
const HealthPage = lazy(() => import("../pages/HealthPage"));
const OfficialServicesPage = lazy(() => import("../pages/OfficialServicesPage"));
const AdminAuthorityDemoPage = lazy(() => import("../pages/AdminAuthorityDemoPage"));


function RequireAuthenticated({ children }: { children: ReactNode }) {
  const { profile } = useApp();
  const location = useLocation();

  if (!profile.isAuthed || !isLoggedIn()) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile, hasRole } = useApp();
  const location = useLocation();

  if (!profile.isAuthed || !isLoggedIn()) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (!hasRole(["admin"])) {
    return (
      <main className="superadmin-access-gate" dir="rtl">
        <section className="superadmin-access-gate__panel" aria-labelledby="superadmin-denied-title">
          <span className="superadmin-access-gate__eyebrow">صلاحيات غير كافية</span>
          <h1 id="superadmin-denied-title">هذه اللوحة للإدارة فقط</h1>
          <p>الحساب الحالي لا يملك صلاحية الوصول إلى مركز الإدارة.</p>
          <a className="superadmin-access-gate__cta" href="/home">العودة إلى الرئيسية</a>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export function AppShell() {
  return (
    <Suspense fallback={<div className="screen-loader" aria-live="polite"><span className="screen-loader__spinner" /> جارٍ تحميل الصفحة…</div>}>
      <Routes>
      <Route
        path="/superadmin/users"
        element={
          <div
            data-apex-shell="superadmin"
            data-apex-foundation="v4-phase-b"
            className="watany-mobile-shell watany-superadmin-shell"
          >
            <RequireAdmin><SuperadminUsersPage /></RequireAdmin>
          </div>
        }
      />
      <Route
        path="/superadmin/*"
        element={
          <div
            data-apex-shell="superadmin"
            data-apex-foundation="v4-phase-b"
            className="watany-mobile-shell watany-superadmin-shell"
          >
            <RequireAdmin><SuperAdminPage /></RequireAdmin>
          </div>
        }
      />
      <Route path="/mobile-os" element={<Navigate to="/" replace />} />
      <Route path="/mobile-os/*" element={<Navigate to="/" replace />} />
      <Route path="/mcp" element={<Navigate to="/home" replace />} />
      <Route path="/mcp/*" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <div
            data-apex-shell="public"
            data-apex-foundation="v4-phase-b"
            className="watany-mobile-shell watany-public-shell"
          >
            <WatanyPublicShellV20 />
          </div>
        }
      >
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route index element={<WatanyGuidedSmokePage />} />
        <Route path="/home" element={<WatanyV4Homepage />} />
        <Route path="/for-you" element={<SmartAttentionFeaturePage featureKey="for-you" />} />
        <Route path="/latest" element={<SmartAttentionFeaturePage featureKey="latest" />} />
        <Route path="/popular" element={<SmartAttentionFeaturePage featureKey="most-requested" />} />
        <Route path="/most-requested" element={<SmartAttentionFeaturePage featureKey="most-requested" />} />
        <Route path="/tools" element={<WatanyV4FeatureLanding />} />
        <Route path="/designs" element={<WatanyV4FeatureLanding />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="procedures" element={<ProceduresPage />} />
        <Route path="school-grants" element={<SchoolGrantsPage />} />
        <Route path="jobs/ainelhafeh" element={<AinElHafehJobsPage />} />
        <Route path="jobs/ainelhafeh/accepted" element={<AinElHafehAcceptedApplicationsPage />} />
        <Route path="superadmin/ainelhafeh/applications" element={<AinElHafehApplicationsAdminPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="marketplace" element={<MarketPage />} />
        <Route path="saved" element={<RequireAuthenticated><SavedChatsPage /></RequireAuthenticated>} />
        <Route path="bookmarks" element={<RequireAuthenticated><BookmarksPage /></RequireAuthenticated>} />
        <Route path="settings" element={<RequireAuthenticated><SettingsPage /></RequireAuthenticated>} />
        <Route path="chat-sessions" element={<RequireAuthenticated><ChatSessionsPage /></RequireAuthenticated>} />
        <Route path="chat" element={<MobileOsChatPage />} />
        <Route path="hybrid-kb-chat" element={<HybridKbChatPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="profile" element={<RequireAuthenticated><div data-watany-feature-route="profile"><ProfilePage /></div></RequireAuthenticated>} />
        <Route path="notifications" element={<RequireAuthenticated><div data-watany-feature-route="notifications"><NotificationsPage /></div></RequireAuthenticated>} />
        <Route path="news" element={<div data-watany-feature-route="news"><NewsPage /></div>} />
        <Route path="fake-fact" element={<div data-watany-feature-route="fake-fact"><FakeFactPage /></div>} />
        <Route path="forms" element={<div data-watany-feature-route="forms"><FormsPage /></div>} />
        <Route path="vote" element={<SurveyPage />} />
        <Route path="voting" element={<Navigate to="/vote" replace />} />
        <Route path="voting/:surveyId" element={<SurveyDetailPage />} />
        <Route path="voting/:surveyId/results" element={<SurveyResultsPage />} />
        <Route path="faq" element={<div data-watany-feature-route="faq"><FaqPage /></div>} />
        <Route path="deaths" element={<div data-watany-feature-route="deaths"><DeathsPage /></div>} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="groups" element={<CommunityThreadsPage />} />
        <Route path="groups/:groupId" element={<CommunityThreadsPage />} />
        <Route path="taxi" element={<TaxiPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="circulars" element={<CircularsPage />} />
        <Route path="children" element={<ChildrenHubPage />} />
        <Route path="sports" element={<WatanyV4FeatureLanding />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="services/official" element={<OfficialServicesPage />} />
        <Route path="admin-authority-demo" element={<AdminAuthorityDemoPage />} />
        <Route path="*" element={<UnavailableRecoveryPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
