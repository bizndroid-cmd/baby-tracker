import React, { useState, useEffect } from 'react';
import { getFeedingStats, getDiaperStats, getSleepStats, getActivity, downloadReport } from '../api';

export default function StatsPanel({ babyId }) {
  const [feedingStats, setFeedingStats] = useState(null);
  const [diaperStats, setDiaperStats] = useState(null);
  const [sleepStats, setSleepStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [days, setDays] = useState(1);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'detailed'
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    loadAll();
  }, [babyId, days]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [feeding, diaper, sleep, act] = await Promise.all([
        getFeedingStats(babyId, { days }),
        getDiaperStats(babyId, { days }),
        getSleepStats(babyId, { days }).catch(() => null),
        getActivity(babyId, { days }),
      ]);
      setFeedingStats(feeding);
      setDiaperStats(diaper);
      setSleepStats(sleep);
      setActivity(act || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError('');
    const timeout = setTimeout(() => { setDownloading(false); setDownloadError('Download timed out.'); }, 30000);
    try {
      await downloadReport(babyId, { days });
    } catch (err) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      clearTimeout(timeout);
      setDownloading(false);
    }
  };

  const handleExportTable = () => {
    let csv;
    if (viewMode === 'daily') {
      const rows = buildDailyTable();
      if (!rows.length) return;
      const header = 'Date,Feeds,Breast (min),Bottle (ml),Diapers,Pee,Poop,Sleep Sessions,Sleep (min)';
      csv = [header, ...rows.map(r => `${r.date},${r.feeds},${r.breastMin},${r.bottleMl},${r.diapers},${r.pee},${r.poop},${r.sleepSessions},${r.sleepMin}`)].join('\n');
    } else {
      if (!activity.length) return;
      const header = 'Time,Category,Type,Duration (min),Quantity (ml),Quantity (oz),Side,Notes';
      csv = [header, ...activity.map(a => {
        const time = a.timestamp || '';
        const cat = a.category || '';
        const type = a.type || '';
        const dur = a.duration_minutes || '';
        const ml = a.quantity_ml || '';
        const oz = a.quantity_oz || '';
        const side = a.side || '';
        const notes = (a.notes || '').replace(/,/g, ';');
        return `${time},${cat},${type},${dur},${ml},${oz},${side},${notes}`;
      })].join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${viewMode}_${days}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const buildDailyTable = () => {
    const dateMap = {};
    const addToDate = (date, key, value) => {
      if (!date) return;
      if (!dateMap[date]) dateMap[date] = { date, feeds: 0, breastMin: 0, bottleMl: 0, diapers: 0, pee: 0, poop: 0, sleepSessions: 0, sleepMin: 0 };
      dateMap[date][key] += value;
    };
    feedingStats?.daily?.forEach((d) => {
      addToDate(d.date, 'feeds', d.total_feeds);
      addToDate(d.date, 'breastMin', d.total_breast_minutes || 0);
      addToDate(d.date, 'bottleMl', Math.round(d.total_ml || 0));
    });
    diaperStats?.daily?.forEach((d) => {
      addToDate(d.date, 'diapers', d.total_changes);
      addToDate(d.date, 'pee', d.pee_count + d.both_count);
      addToDate(d.date, 'poop', d.poop_count + d.both_count);
    });
    sleepStats?.daily?.forEach((d) => {
      addToDate(d.date, 'sleepSessions', d.session_count);
      addToDate(d.date, 'sleepMin', d.total_minutes || 0);
    });
    return Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const activityLabel = (a) => {
    if (a.category === 'feeding') {
      if (a.type === 'breast') return `🤱 Breast ${a.duration_minutes || 0}min${a.side ? ' ('+a.side+')' : ''}`;
      const qty = a.quantity_ml ? `${a.quantity_ml}ml` : `${a.quantity_oz}oz`;
      return `${a.type === 'pumped' ? '🍼 Pumped' : '🧴 Formula'} ${qty}`;
    }
    if (a.category === 'diaper') {
      const emoji = a.type === 'pee' ? '💧' : a.type === 'poop' ? '💩' : '💧💩';
      return `${emoji} ${a.type}`;
    }
    if (a.category === 'sleep') {
      const dur = a.duration_minutes ? `${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m` : 'In Progress';
      return `😴 Sleep — ${dur}`;
    }
    return '';
  };

  if (loading) {
    return <div className="card text-center" style={{ padding: 40 }}><p className="text-muted">Loading...</p></div>;
  }

  if (error) return <p className="error-msg">{error}</p>;

  const dailyRows = buildDailyTable();

  return (
    <div>
      {/* Period Filter */}
      <div className="filter-bar">
        {[1, 3, 7, 14, 30].map((d) => (
          <button key={d} className={`filter-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
            {d === 1 ? 'Today' : d === 3 ? '3 Days' : d === 7 ? '1 Week' : d === 14 ? '2 Weeks' : '30 Days'}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn-primary" onClick={handleDownload} disabled={downloading} style={{ flex: 1 }}>
          {downloading ? 'Downloading...' : '📥 Full Report'}
        </button>
        <button className="btn-outline" onClick={handleExportTable} style={{ flex: 1 }}>
          📊 Export Table
        </button>
      </div>
      {downloadError && <p className="error-msg mb-16">{downloadError}</p>}

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card highlight">
          <div className="stat-value">{feedingStats?.averages?.feeds_per_day || 0}</div>
          <div className="stat-label">Feeds / Day</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{feedingStats?.averages?.ml_per_day || 0}</div>
          <div className="stat-label">ml / Day</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{diaperStats?.averages?.changes_per_day || 0}</div>
          <div className="stat-label">Diapers / Day</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{sleepStats?.averages?.minutes_per_day || 0}</div>
          <div className="stat-label">😴 min / Day</div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="filter-bar">
        <button className={`filter-btn ${viewMode === 'daily' ? 'active' : ''}`} onClick={() => setViewMode('daily')}>
          Daily Summary
        </button>
        <button className={`filter-btn ${viewMode === 'detailed' ? 'active' : ''}`} onClick={() => setViewMode('detailed')}>
          All Entries
        </button>
      </div>

      {/* Daily Summary Table */}
      {viewMode === 'daily' && dailyRows.length > 0 && (
        <div className="card">
          <div className="section-header"><h3>Daily Summary</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Feeds</th>
                  <th>Breast</th>
                  <th>Bottle</th>
                  <th>Diapers</th>
                  <th>💧</th>
                  <th>💩</th>
                  <th>Sleep</th>
                  <th>Sleep min</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.date}>
                    <td className="day-date">{formatDate(row.date)}</td>
                    <td>{row.feeds}</td>
                    <td>{row.breastMin > 0 ? `${row.breastMin}m` : '—'}</td>
                    <td>{row.bottleMl > 0 ? `${row.bottleMl}ml` : '—'}</td>
                    <td>{row.diapers}</td>
                    <td>{row.pee}</td>
                    <td>{row.poop}</td>
                    <td>{row.sleepSessions}</td>
                    <td>{row.sleepMin > 0 ? `${row.sleepMin}m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Entries Table */}
      {viewMode === 'detailed' && activity.length > 0 && (
        <div className="card">
          <div className="section-header"><h3>All Entries ({activity.length})</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="daily-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Activity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="day-date">{formatTimestamp(a.timestamp)}</td>
                    <td>{activityLabel(a)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {((viewMode === 'daily' && dailyRows.length === 0) || (viewMode === 'detailed' && activity.length === 0)) && (
        <div className="card">
          <div className="empty-state">
            <div className="emoji">📊</div>
            <p>No data for this period.</p>
          </div>
        </div>
      )}
    </div>
  );
}
