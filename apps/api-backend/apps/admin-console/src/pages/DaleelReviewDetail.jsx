import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

const JSON_FIELDS = ['required_docs_json', 'contacts_json', 'steps_json', 'tags_json'];

function DaleelReviewDetail() {
  const { tx_no: txNo } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['review-detail', txNo],
    queryFn: async () => {
      const response = await api.get(`/api/admin/review/${txNo}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        title_ar: data.title_ar || '',
        summary_ar: data.summary_ar || '',
        where_to_submit: data.where_to_submit || '',
        required_docs_json: data.required_docs_json || '',
        time_limits: data.time_limits || '',
        amounts_lbp: data.amounts_lbp || '',
        contacts_json: data.contacts_json || '',
        steps_json: data.steps_json || '',
        tags_json: data.tags_json || '',
        review_status: data.review_status || 'pending',
        review_notes: data.review_notes || '',
      });
    }
  }, [data]);

  const validateJsonFields = () => {
    for (const field of JSON_FIELDS) {
      const value = form[field];
      if (!value || !value.trim()) {
        continue;
      }
      try {
        JSON.parse(value);
      } catch (err) {
        alert(`${field} must be valid JSON`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async (status) => {
    if (!validateJsonFields()) {
      return;
    }
    if (status === 'rejected' && !form.review_notes.trim()) {
      alert('Review notes required for rejection');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        review_status: status,
      };
      await api.put(`/api/admin/review/${txNo}`, payload);
      alert('Saved successfully');
      refetch();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert('Save failed: ' + JSON.stringify(detail));
    } finally {
      setSaving(false);
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
        <h1>Daleel Review Detail</h1>
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/daleel-review')} style={{ marginRight: '10px' }}>
            Back
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave('pending')} disabled={saving} style={{ marginRight: '10px' }}>
            Save as Pending
          </button>
          <button className="btn btn-success" onClick={() => handleSave('approved')} disabled={saving} style={{ marginRight: '10px' }}>
            Approve
          </button>
          <button className="btn btn-danger" onClick={() => handleSave('rejected')} disabled={saving}>
            Reject
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '600' }}>Tx No</div>
            <div>{data?.tx_no}</div>
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>Section</div>
            <div>{data?.section || '-'}</div>
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>Reviewed By</div>
            <div>{data?.reviewed_by || '-'}</div>
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>Reviewed At</div>
            <div>{data?.reviewed_at || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div dir="rtl">
          <div className="form-group">
            <label className="form-label">Title (Arabic)</label>
            <input
              className="form-input"
              value={form.title_ar || ''}
              onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Summary (Arabic)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.summary_ar || ''}
              onChange={(e) => setForm({ ...form, summary_ar: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Where to Submit</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.where_to_submit || ''}
              onChange={(e) => setForm({ ...form, where_to_submit: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Required Docs (JSON)</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={form.required_docs_json || ''}
              onChange={(e) => setForm({ ...form, required_docs_json: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Steps (JSON)</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={form.steps_json || ''}
              onChange={(e) => setForm({ ...form, steps_json: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contacts (JSON)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.contacts_json || ''}
              onChange={(e) => setForm({ ...form, contacts_json: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tags (JSON)</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.tags_json || ''}
              onChange={(e) => setForm({ ...form, tags_json: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Time Limits</label>
            <input
              className="form-input"
              value={form.time_limits || ''}
              onChange={(e) => setForm({ ...form, time_limits: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Amounts (LBP)</label>
            <input
              className="form-input"
              value={form.amounts_lbp || ''}
              onChange={(e) => setForm({ ...form, amounts_lbp: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Review Notes</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={form.review_notes || ''}
            onChange={(e) => setForm({ ...form, review_notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export default DaleelReviewDetail;
