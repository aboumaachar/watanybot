import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import KBManager from './pages/KBManager';
import KBEditor from './pages/KBEditor';
import FeedbackQueue from './pages/FeedbackQueue';
import SuperAdminPanel from './pages/SuperAdminPanel';
import KBMappings from './pages/KBMappings';
import KBImportExport from './pages/KBImportExport';
import DaleelReviewQueue from './pages/DaleelReviewQueue';
import DaleelReviewDetail from './pages/DaleelReviewDetail';

const queryClient = new QueryClient();

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {isAuthenticated ? (
          <div className="layout">
            <aside className="sidebar">
              <h2 style={{ marginBottom: '30px' }}>WatanBot Admin</h2>
              <div style={{ marginBottom: '20px', fontSize: '14px', opacity: 0.8 }}>
                {user?.email}
                <br />
                <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
              </div>
              <nav>
                <Link to="/">Dashboard</Link>
                <Link to="/kb">KB Manager</Link>
                <Link to="/kb-mappings">KB Mappings</Link>
                <Link to="/kb-import">KB Import/Export</Link>
                <Link to="/feedback">Feedback Queue</Link>
                <Link to="/daleel-review">Daleel Review</Link>
                {user?.role === 'superadmin' && (
                  <Link to="/superadmin">Superadmin</Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{ marginTop: '20px', opacity: 0.7, background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                >
                  Logout
                </button>
              </nav>
            </aside>
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/kb" element={<KBManager />} />
                <Route path="/kb/new" element={<KBEditor />} />
                <Route path="/kb/:id" element={<KBEditor />} />
                <Route path="/kb-mappings" element={<KBMappings />} />
                <Route path="/kb-import" element={<KBImportExport />} />
                <Route path="/feedback" element={<FeedbackQueue />} />
                <Route path="/daleel-review" element={<DaleelReviewQueue />} />
                <Route path="/daleel-review/:tx_no" element={<DaleelReviewDetail />} />
                {user?.role === 'superadmin' && (
                  <Route path="/superadmin" element={<SuperAdminPanel />} />
                )}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        ) : (
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </Router>
    </QueryClientProvider>
  );
}

export default App;
