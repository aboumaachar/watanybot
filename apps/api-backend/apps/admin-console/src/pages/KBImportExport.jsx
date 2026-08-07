import React, { useState } from 'react';
import api from '../api';

function KBImportExport() {
  const [file, setFile] = useState(null);
  const [diag, setDiag] = useState(null);

  const handleExport = async () => {
    try {
      const res = await api.get('/api/admin/mapping/export', { responseType: 'blob' });
      const url = globalThis.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tx_law_map.csv');
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
      const res = await api.post('/api/admin/mapping/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Imported ${res.data.updated} mappings`);
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const runDiagnostics = async () => {
    try {
      const res = await api.get('/api/admin/kb/diagnostics');
      setDiag(res.data);
    } catch (err) {
      alert('Diagnostics failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <h1>KB v3 Import/Export</h1>
      <div className="card" style={{ marginBottom: '20px' }}>
        <button className="btn btn-secondary" onClick={handleExport}>
          Export CSV
        </button>
        <div style={{ marginTop: '10px' }}>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn btn-primary" onClick={handleImport} style={{ marginLeft: '10px' }}>
            Import CSV
          </button>
        </div>
      </div>

      <div className="card">
        <button className="btn btn-secondary" onClick={runDiagnostics}>
          Run Diagnostics
        </button>
        {diag && (
          <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(diag, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default KBImportExport;
