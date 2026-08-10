import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { WatanyPublicShellV20 } from "./layouts/WatanyPublicShellV20";
import { UnavailableRecoveryPage } from "../pages/WatanyRecoveryPages";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import SalaryPage from "../pages/SalaryPage";
import ProceduresPage from "../pages/ProceduresPage";
import SchoolGrantsPage from "../pages/SchoolGrantsPage";
import SettingsPage from "../pages/SettingsPage";
import SavedChatsPage from "../pages/SavedChatsPage";
import BookmarksPage from "../pages/BookmarksPage";
import ChatSessionsPage from "../pages/ChatSessionsPage";
import JobsPage from "../pages/JobsPage";
import AinElHafehJobsPage from "../pages/AinElHafehJobsPage";
import AinElHafehAcceptedApplicationsPage from "../pages/AinElHafehAcceptedApplicationsPage";
import MarketPage from "../pages/MarketPage";
import SuperAdminPage from "../pages/SuperAdminPage";
import WatanyV4Homepage from "./WatanyV4Homepage";
import MobileOsChatPage from "../pages/MobileOsChatPage";
import HybridKbChatPage from "../pages/hybrid-kb-chat";
import DocumentsPage from "../pages/DocumentsPage";
import LegalPage from "../pages/LegalPage";
import ProfilePage from "../pages/ProfilePage";
import NotificationsPage from "../pages/NotificationsPage";
import NewsPage from "../pages/NewsPage";
import FakeFactPage from "../pages/FakeNewsPage";
import FormsPage from "../pages/FormsPage";
import SurveyDetailPage from "../pages/SurveyDetailPage";
import SurveyResultsPage from "../pages/SurveyResultsPage";
import SurveyPage from "../pages/SurveyPage";
import FaqPage from "../pages/FaqPage";
import DeathsPage from "../pages/DeathsPage";
import CommunityPage from "../pages/CommunityPage";
import CommunityThreadsPage from "../pages/CommunityThreadsPage";
import TaxiPage from "../pages/TaxiPage";
import NetworkPage from "../pages/NetworkPage";
import CircularsPage from "../pages/CircularsPage";
import ChildrenHubPage from "../pages/ChildrenHubPage";
import AdsPage from "../pages/AdsPage";
import HealthPage from "../pages/HealthPage";
import OfficialServicesPage from "../pages/OfficialServicesPage";
import AdminAuthorityDemoPage from "../pages/AdminAuthorityDemoPage";
import WatanyGuidedSmokePage from "../pages/WatanyGuidedHelperSmokePage";
import WatanyV4FeatureLanding from "./WatanyV4FeatureLanding";
import { SmartAttentionFeaturePage } from "../features/smart-attention-native/SmartAttentionPages";
import { useApp } from "../store/app";
import { isLoggedIn } from "../lib/auth";
import "../apex/apex-theme-runtime-v274";


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
    <Routes>
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
  );
}
