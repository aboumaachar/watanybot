import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

function FeedbackQueue() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedItem, setSelectedItem] = useState(null);
  const [action, setAction] = useState('reject');
  const [notes, setNotes] = useState('');
  const [linkedCardId, setLinkedCardId] = useState('');

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['feedback-queue', statusFilter],
    queryFn: async () => {
      const response = await api.get(`/admin/feedback/queue?status=${statusFilter}`);
      return response.data;
    },
  });

  const { data: allCards } = useQuery({
    queryKey: ['all-kb-cards'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/cards?limit=200');
      return response.data;
    },
  });

  const handleResolve = async () => {
    if (!notes) {
      alert('Please add notes');
      return;
    }

    try {
      const payload = {
        action,
        notes,
        ...(action === 'link_existing' && { linked_card_id: linkedCardId }),
      };

      await api.post(`/admin/feedback/${selectedItem.id}/resolve`, payload);
      alert('Feedback resolved successfully');
      setSelectedItem(null);
      setNotes('');
      setLinkedCardId('');
      refetch();
    } catch (err) {
      alert('Failed to resolve feedback: ' + (err.response?.data?.detail || err.message));
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
      <h1>Feedback Queue</h1>

      <div className="card">
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label">Filter by status:</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="open">Open</option>
            <option value="in_review">In Review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Language</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id}>
                <td style={{ maxWidth: '400px' }}>{item.question}</td>
                <td>{item.lang.toUpperCase()}</td>
                <td>
                  <span className={`badge badge-${item.status}`}>
                    {item.status}
                  </span>
                </td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedItem(item)}
                    style={{ padding: '5px 10px' }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!items || items.length === 0) && (
          <p style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
            No feedback items found.
          </p>
        )}
      </div>

      {/* Review Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h2>Review Feedback</h2>

            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px', margin: '15px 0' }}>
              <strong>Question:</strong>
              <p style={{ marginTop: '5px' }}>{selectedItem.question}</p>
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
                Language: {selectedItem.lang.toUpperCase()} | 
                Created: {new Date(selectedItem.created_at).toLocaleString()}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Action</label>
              <select
                className="form-select"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="reject">Reject (not actionable)</option>
                <option value="link_existing">Link to existing KB card</option>
              </select>
            </div>

            {action === 'link_existing' && (
              <div className="form-group">
                <label className="form-label">Select KB Card</label>
                <select
                  className="form-select"
                  value={linkedCardId}
                  onChange={(e) => setLinkedCardId(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {allCards?.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.slug} - {card.locales.en?.title || card.locales.ar?.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes about your decision..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedItem(null);
                  setNotes('');
                  setLinkedCardId('');
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleResolve}>
                Submit Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedbackQueue;
