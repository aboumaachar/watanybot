import React, { useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import KBPage from "./pages/KBPage";
import TicketsPage from "./pages/TicketsPage";
import ChatSessionsPage from "./pages/ChatSessionsPage";
import AILearningPage from "./pages/AILearningPage";
import AppManagementPage from "./pages/AppManagementPage";
import SalaryPage from "./pages/SalaryPage";
import MarketplacePage from "./pages/MarketplacePage";
import RulesEnginePage from "./pages/RulesEnginePage";
import SalaryEditorPage from "./pages/SalaryEditorPage";
import KBValuesEditorPage from "./pages/KBValuesEditorPage";
import KBStudioPage from "./pages/KBStudioPage";

type Route =
  | "dashboard"
  | "kb"
  | "kbValues"
  | "kbStudio"
  | "rules"
  | "salaryEditor"
  | "tickets"
  | "chats"
  | "ai"
  | "salary"
  | "plugins"
  | "management";

const NAV: { id: Route; icon: string; label: string }[] = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "kb", icon: "📚", label: "Knowledge Base" },
  { id: "kbValues", icon: "💎", label: "KB Values Editor" },
  { id: "kbStudio", icon: "🏗️", label: "KB Studio" },
  { id: "rules", icon: "🔧", label: "Rules Engine" },
  { id: "salaryEditor", icon: "📝", label: "Salary Editor" },
  { id: "tickets", icon: "🎫", label: "Tickets & Cases" },
  { id: "chats", icon: "💬", label: "Live Chats" },
  { id: "ai", icon: "🤖", label: "AI & Learning" },
  { id: "salary", icon: "💰", label: "Salary Calculator" },
  { id: "plugins", icon: "🛒", label: "Plugins & Market" },
  { id: "management", icon: "⚙️", label: "App Management" },
];

export default function App() {
  const [route, setRoute] = useState<Route>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {!collapsed && <h2>WatanyBot Admin</h2>}
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${route === item.id ? "active" : ""}`}
              onClick={() => setRoute(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <span className="version">v1.0.0</span>}
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {route === "dashboard" && <DashboardPage />}
        {route === "kb" && <KBPage />}
        {route === "kbValues" && <KBValuesEditorPage />}
        {route === "kbStudio" && <KBStudioPage />}
        {route === "rules" && <RulesEnginePage />}
        {route === "salaryEditor" && <SalaryEditorPage />}
        {route === "tickets" && <TicketsPage />}
        {route === "chats" && <ChatSessionsPage />}
        {route === "ai" && <AILearningPage />}
        {route === "salary" && <SalaryPage />}
        {route === "plugins" && <MarketplacePage />}
        {route === "management" && <AppManagementPage />}
      </main>
    </div>
  );
}
