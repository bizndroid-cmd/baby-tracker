import React, { useState, useEffect } from 'react';
import { getFeedingStats, getDiaperStats, getSleepStats, downloadReport } from '../api';

export default function StatsPanel({ babyId }) {
  const [feedingStats, setFeedingStats] = useState(null);
  const [diaperStats, setDiaperStats] = useState(null);
  const [sleepStats, setSleepStats] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    loadStats();
  }, [babyId, days]);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const [feeding, diaper, sleep] = await Promise.all([
        getFeedingStats(babyId, { days }),
        getDiaperStats(babyId, { days }),
        getSleepStats(babyId, { days }).catch(() => null),
      ]);
      setFeedingStats(feeding);
      setDiaperStats(diaper);
      setSleepStats(sleep);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError('');
    const timeout = setTimeout(() => {
      setDownloading(false);
      setDownloadError('Download timed out. Please try again.');
    }, 30000);
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
    const rows = buildDailyTable();
    if (!rows.length) return;
    const header = ['Date', 'Feeds', 'Breast (min)', 'Bottle (ml)', 'Diapers', 'Pee', 'Poop', 'Sleep Sessions', 'Sleep (min)'];
    const csv = [header.join(','), ...rows.map((r) => [
      r.date, r.feeds, r.breastMin, r.bottleMl, r.diapers, r.pee, r.poop, r.sleepSessions, r.sleepMin
    ].join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daily_summary_${days}d.csv`;
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

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: 40 }}>
        <p className="text-muted">Loading stats...</p>
      </div>
    );
  }

  if (error) {
    return <p className="error-msg">{error}</p>;
  }

  const dailyRows = buildDailyTable();

  return (
    <div>
      {/* Period Filter */}
      <div className="filter-bar">
        {[3, 7, 14, 30].map((d) => (
          <button
            key={d}
            className={`filter-btn ${days === d ? 'active' : ''}`}
            onClick={() => setDays(d)}
          >
            {d === 3 ? '3 Days' : d === 7 ? '1 Week' : d === 14 ? '2 Weeks' : '30 Days'}
          </button>
        ))}
      </div>

      {/* Download Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn-primary" onClick={handleDownload} disabled={downloading} style={{ flex: 1 }}>
          {downloading ? 'Downloading...' : '📥 Full Report (CSV)'}
        </button>
        <button className="btn-outline" onClick={handleExportTable} disabled={!dailyRows.length} style={{ flex: 1 }}>
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
          <div className="stat-label">😴 Sleep min / Day</div>
        </div>
      </div>

      {/* Unified Daily Table */}
      {dailyRows.length > 0 && (
        <div className="card">
          <div className="section-header">
            <h3>Daily Summary</h3>
          </div>
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

      {dailyRows.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="emoji">📊</div>
            <p>No data for this period. Start logging to see insights.</p>
          </div>
        </div>
      )}
    </div>
  );
}
