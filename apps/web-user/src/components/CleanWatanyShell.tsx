import { useEffect, useMemo, useState } from "react";
import "./clean-watany-shell.css";

type RouteKey =
  | "home"
  | "login"
  | "register"
  | "salary"
  | "procedures"
  | "school-grants"
  | "jobs"
  | "marketplace";

type RouteItem = {
  key: RouteKey;
  path: string;
  label: string;
  summary: string;
  testId: string;
};

const routes: RouteItem[] = [
  { key: "salary", path: "/salary", label: "Salary calculator", summary: "Rank, degree, family and deduction calculator.", testId: "clean-route-salary" },
  { key: "procedures", path: "/procedures", label: "Procedures", summary: "Guided official procedure checklist.", testId: "clean-route-procedures" },
  { key: "school-grants", path: "/school-grants", label: "School grants", summary: "School aid papers, forms, and next steps.", testId: "clean-route-school-grants" },
  { key: "jobs", path: "/jobs", label: "Jobs", summary: "Civilian opportunities for veterans and family.", testId: "clean-route-jobs" },
  { key: "marketplace", path: "/marketplace", label: "Marketplace", summary: "Trusted network listings and services.", testId: "clean-route-marketplace" },
];

const pathToRoute: Record<string, RouteKey> = {
  "/": "home",
  "/login": "login",
  "/register": "register",
  "/salary": "salary",
  "/procedures": "procedures",
  "/school-grants": "school-grants",
  "/jobs": "jobs",
  "/marketplace": "marketplace",
};

function currentRoute(): RouteKey {
  return pathToRoute[window.location.pathname] ?? "home";
}

export function CleanWatanyShell() {
  const [route, setRoute] = useState<RouteKey>(() => currentRoute());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const active = useMemo(
    () => routes.find((item) => item.key === route),
    [route],
  );

  function go(path: string) {
    window.history.pushState({}, "", path);
    setRoute(currentRoute());
    setMenuOpen(false);
  }

  return (
    <main className="clean-watany-shell" data-apex-v3-shell="true">
      <header className="clean-header">
        <button
          type="button"
          className="clean-icon-button"
          data-testid="clean-menu-button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          Menu
        </button>

        <button
          type="button"
          className="clean-brand"
          data-testid="clean-home-button"
          onClick={() => go("/")}
        >
          <span className="clean-logo">W</span>
          <span>
            <strong>Watany</strong>
            <small>Veterans service platform</small>
          </span>
        </button>

        <button
          type="button"
          className="clean-login-button"
          data-testid="clean-login-button"
          onClick={() => go("/login")}
        >
          Login
        </button>
      </header>

      <section className="clean-ticker" data-testid="clean-ticker">
        Updates, procedures, salary, school grants, jobs, and marketplace in one simple mobile shell.
      </section>

      {menuOpen ? (
        <nav className="clean-drawer" data-testid="clean-menu-panel">
          <button type="button" data-testid="clean-route-home" onClick={() => go("/")}>Home</button>
          <button type="button" data-testid="clean-route-login" onClick={() => go("/login")}>Login</button>
          <button type="button" data-testid="clean-route-register" onClick={() => go("/register")}>Register</button>
          {routes.map((item) => (
            <button key={item.key} type="button" data-testid={item.testId} onClick={() => go(item.path)}>
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}

      <section className="clean-content" data-testid="clean-content">
        {route === "home" ? (
          <div className="clean-home" data-testid="clean-home">
            <h1>What do you need today?</h1>
            <p className="clean-lead">Simple guided actions for retired military personnel and their families.</p>
            <div className="clean-grid">
                <div className="clean-groups" data-testid="clean-home-groups">
                  {[
                    "الملف",
                    "التعاميم",
                    "الأعمال",
                    "الأدوات",
                    "الخدمات",
                    "المجتمع",
                    "الكل",
                  ].map((g, i) => (
                    <button key={g} type="button" className="clean-group" data-testid={`clean-group-${i}`} onClick={() => go("/")}>
                      {g}
                    </button>
                  ))}
                </div>
              {routes.map((item) => (
                <button key={item.key} type="button" className="clean-card" data-testid={item.testId} onClick={() => go(item.path)}>
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                </button>
              ))}
              <button type="button" className="clean-card clean-card-soft" data-testid="clean-other-choice">
                <strong>Something else</strong>
                <span>Start with guided help if your case is not listed.</span>
              </button>
            </div>
          </div>
        ) : route === "login" ? (
          <div className="clean-panel" data-testid="clean-login-panel">
            <h1>Login</h1>
            <p>Login flow placeholder ready for real authentication wiring.</p>
            <button type="button" data-testid="clean-register-button" onClick={() => go("/register")}>Create account</button>
          </div>
        ) : route === "register" ? (
          <div className="clean-panel" data-testid="clean-register-panel">
            <h1>Register</h1>
            <p>Registration flow placeholder ready for OTP and profile setup.</p>
            <button type="button" data-testid="clean-login-return" onClick={() => go("/login")}>Back to login</button>
          </div>
        ) : (
          <div className="clean-panel" data-testid={"clean-page-" + route}>
            <h1>{active?.label ?? "Watany"}</h1>
            <p>{active?.summary ?? "Guided service page."}</p>
            <button type="button" data-testid="clean-back-home" onClick={() => go("/")}>Back home</button>
          </div>
        )}
      </section>

      <footer className="clean-chat-dock" data-testid="clean-chat-dock">
        اسأل موطني
      </footer>
    </main>
  );
}

export default CleanWatanyShell;