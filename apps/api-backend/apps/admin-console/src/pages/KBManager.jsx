import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function KBManager() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['kb-cards', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const response = await api.get(`/admin/kb/cards${params}`);
      return response.data;
    },
  });

  const handlePublish = async (cardId) => {
    if (confirm('Are you sure you want to publish this card?')) {
      try {
        await api.post(`/admin/kb/cards/${cardId}/publish`);
        alert('Card published successfully');
        refetch();
      } catch (err) {
        alert('Failed to publish card: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleArchive = async (cardId) => {
    if (confirm('Are you sure you want to archive this card?')) {
      try {
        await api.post(`/admin/kb/cards/${cardId}/archive`);
        alert('Card archived successfully');
        refetch();
      } catch (err) {
        alert('Failed to archive card: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Knowledge Base Manager</h1>
        <button className="btn btn-primary" onClick={() => navigate('/kb/new')}>
          + New Card
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label">Filter by status:</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title (EN)</th>
              <th>Status</th>
              <th>Version</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards?.map((card) => (
              <tr key={card.id}>
                <td>{card.slug}</td>
                <td>{card.locales.en?.title || card.locales.ar?.title || 'Untitled'}</td>
                <td>
                  <span className={`badge badge-${card.status}`}>
                    {card.status}
                  </span>
                </td>
                <td>v{card.version}</td>
                <td>{new Date(card.updated_at).toLocaleString()}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/kb/${card.id}`)}
                    style={{ marginRight: '5px', padding: '5px 10px' }}
                  >
                    Edit
                  </button>
                  {card.status === 'draft' && (
                    <button
                      className="btn btn-success"
                      onClick={() => handlePublish(card.id)}
                      style={{ marginRight: '5px', padding: '5px 10px' }}
                    >
                      Publish
                    </button>
                  )}
                  {card.status === 'published' && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleArchive(card.id)}
                      style={{ padding: '5px 10px' }}
                    >
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!cards || cards.length === 0) && (
          <p style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
            No cards found. Click "New Card" to create one.
          </p>
        )}
      </div>
    </div>
  );
}

export default KBManager;
