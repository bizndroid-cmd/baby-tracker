import React, { useState, useEffect } from 'react';
import { getSleepRecords, addSleepRecord, updateSleepRecord, deleteSleepRecord } from '../api';
import Modal from './Modal';

function getCurrentDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toLocalInput(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SleepPanel({ babyId }) {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [startTime, setStartTime] = useState(getCurrentDateTime());
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Edit state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');

  // End session with custom time
  const [endingId, setEndingId] = useState(null);
  const [endSessionTime, setEndSessionTime] = useState('');

  useEffect(() => {
    loadRecords();
  }, [babyId]);

  const loadRecords = async () => {
    try {
      const data = await getSleepRecords(babyId);
      setRecords(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (endTime) {
      if (new Date(endTime) <= new Date(startTime)) {
        setError('End time must be after start time');
        return;
      }
    }
    try {
      const record = await addSleepRecord(babyId, {
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : undefined,
        notes: notes || undefined,
      });
      setRecords([record, ...records]);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEndSession = async (sleepId) => {
    if (endingId !== sleepId) {
      setEndingId(sleepId);
      setEndSessionTime(getCurrentDateTime());
      return;
    }
    try {
      const updated = await updateSleepRecord(babyId, sleepId, {
        end_time: new Date(endSessionTime).toISOString(),
      });
      setRecords(records.map((r) => (r.id === sleepId ? updated : r)));
      setEndingId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (r) => {
    setEditingRecord(r);
    setEditStart(toLocalInput(r.start_time));
    setEditEnd(toLocalInput(r.end_time));
    setEditNotes(r.notes || '');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (editEnd && new Date(editEnd) <= new Date(editStart)) {
      setEditError('End time must be after start time');
      return;
    }
    try {
      const updated = await updateSleepRecord(babyId, editingRecord.id, {
        start_time: new Date(editStart).toISOString(),
        end_time: editEnd ? new Date(editEnd).toISOString() : null,
        notes: editNotes || null,
      });
      setRecords(records.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRecord(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleDelete = async (sleepId) => {
    if (confirmDeleteId !== sleepId) {
      setConfirmDeleteId(sleepId);
      return;
    }
    try {
      await deleteSleepRecord(babyId, sleepId);
      setRecords(records.filter((r) => r.id !== sleepId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setStartTime(getCurrentDateTime());
    setEndTime('');
    setNotes('');
    setError('');
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {!showForm ? (
        <button className="btn-primary btn-full" onClick={() => { setStartTime(getCurrentDateTime()); setShowForm(true); }}>
          + Log Sleep
        </button>
      ) : (
        <div className="card mt-16">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="sleep-start">Start Time</label>
              <input id="sleep-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="sleep-end">End Time (leave empty if still sleeping)</label>
              <input id="sleep-end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="sleep-notes">Notes (optional)</label>
              <textarea id="sleep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." maxLength={500} rows={2} style={{ resize: 'vertical' }} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-success">Save</button>
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Sleep records list */}
      <div className="card mt-16">
        <div className="section-header">
          <h3>Recent Sleep</h3>
        </div>
        {records.length === 0 ? (
          <p className="text-muted text-sm">No sleep records yet</p>
        ) : (
          records.map((r) => (
            <div key={r.id} className="entry-item">
              <div className="entry-info">
                <h4>😴 {formatTime(r.start_time)}{r.end_time ? ` — ${formatTime(r.end_time)}` : ''}</h4>
                <p>
                  {r.duration_minutes !== null ? formatDuration(r.duration_minutes) : <span style={{ color: 'var(--primary)', fontWeight: 600 }}>In Progress</span>}
                  {r.notes ? ` — ${r.notes}` : ''}
                </p>
                {/* End session with time picker */}
                {endingId === r.id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="datetime-local" value={endSessionTime} onChange={(e) => setEndSessionTime(e.target.value)} style={{ flex: 1, padding: '6px 8px', fontSize: 12 }} />
                    <button className="btn-success btn-sm" onClick={() => handleEndSession(r.id)}>Save</button>
                    <button className="btn-secondary btn-sm" onClick={() => setEndingId(null)}>Cancel</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.duration_minutes === null && endingId !== r.id && (
                  <button className="btn-success btn-sm" onClick={() => handleEndSession(r.id)}>End</button>
                )}
                <button className="btn-outline btn-sm" onClick={() => startEdit(r)}>Edit</button>
                {confirmDeleteId === r.id ? (
                  <>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
                    <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="delete-btn" onClick={() => handleDelete(r.id)} aria-label="Delete sleep record">×</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editingRecord} onClose={() => setEditingRecord(null)} title="Edit Sleep">
        {editingRecord && (
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label>Start Time</label>
              <input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} maxLength={500} rows={2} style={{ resize: 'vertical' }} />
            </div>
            {editError && <p className="error-msg">{editError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-success">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingRecord(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
