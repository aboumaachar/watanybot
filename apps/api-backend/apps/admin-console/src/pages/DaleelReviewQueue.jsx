import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function DaleelReviewQueue() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [file, setFile] = useState(null);

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['review-queue', statusFilter, search],
    queryFn: async () => {
      const response = await api.get('/api/admin/review/queue', {
        params: { status: statusFilter, q: search || undefined, limit: 100 },
      });
      return response.data;
    },
  });

  const handleExport = async () => {
    try {
      const res = await api.get('/api/admin/review/export', {
        params: { status: statusFilter },
        responseType: 'blob',
      });
      const url = globalThis.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `review_queue_${statusFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleImport = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/admin/review/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Imported ${res.data.updated_count} items`);
      setFile(null);
      refetch();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert('Import failed: ' + JSON.stringify(detail));
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
        <h1>Daleel Review</h1>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tx_no or title"
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={handleExport}>
              Export CSV
            </button>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
            <button className="btn btn-primary" onClick={handleImport} style={{ marginLeft: '10px' }}>
              Import CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Tx No</th>
              <th>Title</th>
              <th>Section</th>
              <th>Status</th>
              <th>Missing Fields</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.tx_no}>
                <td>{item.tx_no}</td>
                <td dir="rtl">{item.title_ar || '-'}</td>
                <td>{item.section || '-'}</td>
                <td>
                  <span className={`badge badge-${item.review_status}`}>
                    {item.review_status}
                  </span>
                </td>
                <td>
                  {item.missing_fields?.length
                    ? item.missing_fields.map((field) => (
                        <span key={field} className="badge badge-pending" style={{ marginRight: '6px' }}>
                          {field}
                        </span>
                      ))
                    : '-'}
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/daleel-review/${item.tx_no}`)}
                    style={{ padding: '5px 10px' }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!items || items.length === 0) && (
          <p style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
            No items in this queue.
          </p>
        )}
      </div>
    </div>
  );
}

export default DaleelReviewQueue;
