import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

function Dashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const response = await api.get('/superadmin/metrics');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{metrics?.published_kb_cards || 0}</div>
          <div className="stat-label">Published KB Cards</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{metrics?.total_kb_cards || 0}</div>
          <div className="stat-label">Total KB Cards</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{metrics?.total_chat_sessions || 0}</div>
          <div className="stat-label">Total Chat Sessions</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{metrics?.open_feedback_items || 0}</div>
          <div className="stat-label">Open Feedback Items</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">System Overview</h2>
        </div>
        <p>Welcome to the WatanBot Admin Console. Use the sidebar to navigate between sections.</p>
        <ul style={{ marginTop: '15px', marginLeft: '20px' }}>
          <li><strong>KB Manager:</strong> Create, edit, and publish knowledge base cards</li>
          <li><strong>Feedback Queue:</strong> Review and resolve user feedback</li>
          <li><strong>Superadmin:</strong> System health, backups, and audit logs</li>
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
