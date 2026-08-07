import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

function KBEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [slug, setSlug] = useState('');
  const [activeTab, setActiveTab] = useState('ar');
  const [ar, setAr] = useState({ title: '', summary: '', body: '', tags: [] });
  const [en, setEn] = useState({ title: '', summary: '', body: '', tags: [] });
  const [sources, setSources] = useState('');
  const [saving, setSaving] = useState(false);

  // Load existing card if editing
  const { data: card } = useQuery({
    queryKey: ['kb-card', id],
    queryFn: async () => {
      const response = await api.get(`/admin/kb/cards`);
      return response.data.find(c => c.id === id);
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (card) {
      setSlug(card.slug);
      setAr(card.locales.ar || { title: '', summary: '', body: '', tags: [] });
      setEn(card.locales.en || { title: '', summary: '', body: '', tags: [] });
      setSources(card.sources ? JSON.stringify(card.sources, null, 2) : '');
    }
  }, [card]);

  const handleSave = async () => {
    if (!slug) {
      alert('Slug is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        slug,
        locales: { ar, en },
        sources: sources ? JSON.parse(sources) : null,
      };

      if (isNew) {
        await api.post('/admin/kb/cards', payload);
        alert('Card created successfully');
      } else {
        await api.put(`/admin/kb/cards/${id}`, payload);
        alert('Card updated successfully');
      }

      navigate('/kb');
    } catch (err) {
      alert('Failed to save card: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const currentLocale = activeTab === 'ar' ? ar : en;
  const setCurrentLocale = activeTab === 'ar' ? setAr : setEn;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{isNew ? 'New KB Card' : 'Edit KB Card'}</h1>
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/kb')} style={{ marginRight: '10px' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Slug (unique identifier)</label>
          <input
            type="text"
            className="form-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g., services-electricity-billing"
          />
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'ar' ? 'active' : ''}`}
            onClick={() => setActiveTab('ar')}
          >
            Arabic (العربية)
          </button>
          <button
            className={`tab ${activeTab === 'en' ? 'active' : ''}`}
            onClick={() => setActiveTab('en')}
          >
            English
          </button>
        </div>

        <div dir={activeTab === 'ar' ? 'rtl' : 'ltr'}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              value={currentLocale.title}
              onChange={(e) => setCurrentLocale({ ...currentLocale, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Summary (brief answer)</label>
            <textarea
              className="form-textarea"
              value={currentLocale.summary}
              onChange={(e) => setCurrentLocale({ ...currentLocale, summary: e.target.value })}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Body (detailed content)</label>
            <textarea
              className="form-textarea"
              value={currentLocale.body}
              onChange={(e) => setCurrentLocale({ ...currentLocale, body: e.target.value })}
              rows={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={currentLocale.tags.join(', ')}
              onChange={(e) => setCurrentLocale({
                ...currentLocale,
                tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
              })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Sources (JSON, optional)</label>
          <textarea
            className="form-textarea"
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            rows={4}
            placeholder='{"url": "https://example.com", "title": "Source Title"}'
          />
        </div>
      </div>
    </div>
  );
}

export default KBEditor;
