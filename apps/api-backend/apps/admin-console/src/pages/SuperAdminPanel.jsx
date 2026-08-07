import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState('doctor');

  const { data: doctor, isLoading: doctorLoading, refetch: refetchDoctor } = useQuery({
    queryKey: ['doctor'],
    queryFn: async () => {
      const response = await api.get('/superadmin/doctor');
      return response.data;
    },
    enabled: activeTab === 'doctor',
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await api.get('/superadmin/audit?limit=50');
      return response.data;
    },
    enabled: activeTab === 'audit',
  });

  const handleBackup = async () => {
    if (!confirm('Create a database backup? This may take a few moments.')) return;

    try {
      const response = await api.post('/superadmin/backup');
      alert(`Backup created successfully:\n${response.data.backup_file}\nSize: ${(response.data.size_bytes / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      alert('Backup failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <h1>Superadmin Panel</h1>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'doctor' ? 'active' : ''}`}
          onClick={() => setActiveTab('doctor')}
        >
          Health Checks
        </button>
        <button
          className={`tab ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          Backup & Restore
        </button>
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Logs
        </button>
      </div>

      {/* Doctor Tab */}
      {activeTab === 'doctor' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">System Health Checks</h2>
            <button className="btn btn-primary" onClick={() => refetchDoctor()}>
              Refresh
            </button>
          </div>

          {doctorLoading ? (
            <div className="loading">
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div className={`alert ${
                doctor?.overall_status === 'ok' ? 'alert-success' :
                doctor?.overall_status === 'warning' ? 'alert-info' :
                'alert-error'
              }`}>
                Overall Status: <strong>{doctor?.overall_status?.toUpperCase()}</strong>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {doctor?.checks?.map((check, idx) => (
                    <tr key={idx}>
                      <td>{check.check.replace(/_/g, ' ')}</td>
                      <td>
                        <span className={`badge ${
                          check.status === 'ok' ? 'badge-published' :
                          check.status === 'warning' ? 'badge-draft' :
                          'badge-open'
                        }`}>
                          {check.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{check.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && (
        <div className="card">
          <h2 className="card-title">Backup & Restore</h2>
          <p style={{ marginBottom: '20px', color: '#7f8c8d' }}>
            Create database backups and restore from previous backups.
          </p>

          <button className="btn btn-success" onClick={handleBackup}>
            Create Backup Now
          </button>

          <div className="alert alert-info" style={{ marginTop: '20px' }}>
            <strong>Note:</strong> Backups are stored in the configured backup directory.
            Use the command-line scripts for restore operations.
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="card">
          <h2 className="card-title">Audit Logs (Last 50)</h2>

          {auditLoading ? (
            <div className="loading">
              <div className="spinner" />
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs?.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td>{log.target_type || '-'}</td>
                    <td style={{ maxWidth: '300px', fontSize: '12px', color: '#7f8c8d' }}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default SuperAdminPanel;
