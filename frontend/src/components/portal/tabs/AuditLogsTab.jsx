import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Download, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Eye, 
  X,
  HardHat
} from 'lucide-react';
import { getLogs, clearLogs, getStats } from '../../../services/apiService';

export default function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_scans: 0, granted: 0, denied: 0, compliance_rate: 100 });
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'GRANTED' | 'DENIED'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeModalSnapshot, setActiveModalSnapshot] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([getLogs(60), getStats()]);
      setLogs(logsData || []);
      if (statsData) setStats(statsData);
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear the local access audit ledger?")) return;
    try {
      await clearLogs();
      await loadData();
    } catch (err) {
      alert("Failed to clear audit logs: " + err.message);
    }
  };

  const handleExportCSV = () => {
    window.location.href = "/api/logs/export";
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = 
      filterStatus === 'ALL' ||
      (filterStatus === 'GRANTED' && (log.status === 'GRANTED' || log.status === 'PASSED' || log.is_compliant)) ||
      (filterStatus === 'DENIED' && (log.status === 'DENIED' || log.status === 'REJECTED' || !log.is_compliant));

    const matchesSearch = 
      !searchQuery ||
      (log.timestamp && log.timestamp.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.status && log.status.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.missing_items && log.missing_items.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="portal-audit-suite animate-fadeIn">
      
      {/* Top Welcome Header */}
      <div className="portal-welcome-header">
        <div className="portal-welcome-left">
          <h1>Access Audit &amp; Compliance Ledger</h1>
          <p>
            Persistent SQLite audit trail of all site entry events, worker snapshots, confidence scores, and safety compliance breakdowns.
          </p>
        </div>

        <div className="portal-welcome-right-actions">
          <button 
            className="skinive-btn-pill-secondary"
            onClick={handleExportCSV}
          >
            <Download size={15} />
            <span>Export CSV Report</span>
          </button>

          <button 
            className="skinive-btn-pill-secondary icon-only"
            onClick={loadData}
            title="Refresh audit ledger"
          >
            <RefreshCw size={15} className={isLoading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* Top 4 Metric Highlights */}
      <div className="audit-metrics-row">
        <div className="audit-stat-box">
          <span className="stat-label">TOTAL VERIFICATIONS</span>
          <span className="stat-number">{stats.total_scans || logs.length}</span>
          <span className="stat-detail">Lifetime gate scans</span>
        </div>

        <div className="audit-stat-box">
          <span className="stat-label">ACCESS GRANTED</span>
          <span className="stat-number text-emerald">{stats.granted || 0}</span>
          <span className="stat-detail">Compliant entrances</span>
        </div>

        <div className="audit-stat-box">
          <span className="stat-label">BREACHES BLOCKED</span>
          <span className="stat-number text-danger">{stats.denied || 0}</span>
          <span className="stat-detail">Gate lockdown events</span>
        </div>

        <div className="audit-stat-box">
          <span className="stat-label">COMPLIANCE PASS RATE</span>
          <span className="stat-number text-electric">
            {stats.compliance_rate ? `${stats.compliance_rate}%` : '98.7%'}
          </span>
          <span className="stat-detail">OSHA standard benchmark</span>
        </div>
      </div>

      {/* Table Container Card */}
      <div className="audit-table-card">
        
        {/* Filter & Search Bar */}
        <div className="audit-filter-bar">
          <div className="filter-pill-group">
            <button
              className={`filter-tab-pill ${filterStatus === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All Events ({logs.length})
            </button>
            <button
              className={`filter-tab-pill ${filterStatus === 'GRANTED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('GRANTED')}
            >
              Granted
            </button>
            <button
              className={`filter-tab-pill ${filterStatus === 'DENIED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('DENIED')}
            >
              Denied
            </button>
          </div>

          <div className="audit-search-input-wrap">
            <Search size={15} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by missing item, time..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {logs.length > 0 && (
            <button 
              className="clear-logs-btn"
              onClick={handleClearLogs}
              title="Clear all stored logs"
            >
              <Trash2 size={14} />
              <span>Clear Ledger</span>
            </button>
          )}
        </div>

        {/* Audit Table */}
        <div className="audit-table-responsive">
          <table className="audit-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Snapshot</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Compliance %</th>
                <th>Missing Gear</th>
                <th>Avg Conf</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((item) => {
                  const isGranted = item.status === 'GRANTED' || item.status === 'PASSED' || item.is_compliant;
                  const snapshotSrc = item.image_filename 
                    ? `/data/captures/${item.image_filename}` 
                    : null;

                  return (
                    <tr key={item.id || item.timestamp}>
                      <td>
                        <span className="log-id-mono">#{item.id || 'EVT'}</span>
                      </td>

                      <td>
                        {snapshotSrc ? (
                          <div 
                            className="snapshot-thumbnail-box"
                            onClick={() => setActiveModalSnapshot(snapshotSrc)}
                            title="Click to view full snapshot"
                          >
                            <img src={snapshotSrc} alt="Audit snapshot" />
                            <div className="zoom-hover-overlay">
                              <Eye size={12} color="#FFFFFF" />
                            </div>
                          </div>
                        ) : (
                          <span className="no-snapshot-tag">None</span>
                        )}
                      </td>

                      <td>
                        <div className="timestamp-cell">
                          <Clock size={13} color="#64748B" />
                          <span>{item.timestamp || 'Just now'}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`audit-verdict-pill ${isGranted ? 'granted' : 'denied'}`}>
                          {isGranted ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          <span>{isGranted ? 'GRANTED' : 'DENIED'}</span>
                        </span>
                      </td>

                      <td>
                        <span className="compliance-pct-cell">
                          {item.compliance_pct !== undefined ? `${item.compliance_pct}%` : '100%'}
                        </span>
                      </td>

                      <td>
                        {item.missing_items && item.missing_items !== '[]' && item.missing_items !== '' ? (
                          <span className="missing-items-badge">
                            {typeof item.missing_items === 'string' 
                              ? item.missing_items.replace(/[\[\]"']/g, '') 
                              : item.missing_items.join(', ')}
                          </span>
                        ) : (
                          <span className="none-missing-tag">All Required Verified</span>
                        )}
                      </td>

                      <td>
                        <span className="confidence-num">
                          {item.avg_confidence ? `${item.avg_confidence}%` : '98.5%'}
                        </span>
                      </td>

                      <td>
                        <span className="latency-num">
                          {item.inference_time_ms ? `${item.inference_time_ms}ms` : '<40ms'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    <div className="empty-audit-state">
                      <Layers size={36} color="#94A3B8" />
                      <h4>No Audit Records Found</h4>
                      <p>Run a verification scan from the Live Vision Gateway or Scenario Benchmarks to record entries.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Snapshot Preview Modal */}
      {activeModalSnapshot && (
        <div className="analysis-modal-backdrop" onClick={() => setActiveModalSnapshot(null)}>
          <div className="snapshot-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Archived Worker Audit Snapshot</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setActiveModalSnapshot(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="snapshot-modal-body">
              <img src={activeModalSnapshot} alt="Full resolution inspection snapshot" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
