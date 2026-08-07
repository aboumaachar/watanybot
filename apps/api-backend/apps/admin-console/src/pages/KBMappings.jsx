import React, { useState } from 'react';
import api from '../api';

function KBMappings() {
  const [txNo, setTxNo] = useState('');
  const [articleNo, setArticleNo] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (txNo) params.append('tx_no', txNo);
      if (articleNo) params.append('article_no', articleNo);
      const res = await api.get(`/api/admin/mapping?${params.toString()}`);
      setItems(res.data.items || []);
    } catch (err) {
      alert('Failed to load mappings: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const updateRow = async (row) => {
    try {
      await api.put(`/api/admin/mapping/${row.tx_no}/${row.article_no}`, null, {
        params: {
          relevance: row.relevance,
          rationale: row.rationale,
        },
      });
      alert('Mapping updated');
    } catch (err) {
      alert('Update failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <h1>KB Mapping Review</h1>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="tx_no"
            value={txNo}
            onChange={(e) => setTxNo(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="article_no"
            value={articleNo}
            onChange={(e) => setArticleNo(e.target.value)}
          />
          <button className="btn btn-primary" onClick={fetchMappings}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>tx_no</th>
                <th>article_no</th>
                <th>relevance</th>
                <th>rationale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={`${row.tx_no}-${row.article_no}-${idx}`}>
                  <td>{row.tx_no}</td>
                  <td>{row.article_no}</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={row.relevance}
                      onChange={(e) => {
                        const value = Number.parseFloat(e.target.value);
                        const next = [...items];
                        next[idx].relevance = Number.isNaN(value) ? 0 : value;
                        setItems(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      value={row.rationale || ''}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].rationale = e.target.value;
                        setItems(next);
                      }}
                    />
                  </td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => updateRow(row)}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default KBMappings;
