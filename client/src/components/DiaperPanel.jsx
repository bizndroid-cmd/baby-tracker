import React, { useState, useEffect } from 'react';
import { getDiapers, addDiaper, deleteDiaper, updateDiaper } from '../api';
import Modal from './Modal';

function getCurrentDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function DiaperPanel({ babyId }) {
  const [diapers, setDiapers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('pee');
  const [notes, setNotes] = useState('');
  const [changedAt, setChangedAt] = useState(getCurrentDateTime());
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Edit state
  const [editingDiaper, setEditingDiaper] = useState(null);
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editChangedAt, setEditChangedAt] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    loadDiapers();
  }, [babyId]);

  const loadDiapers = async () => {
    try {
      const data = await getDiapers(babyId);
      setDiapers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const diaper = await addDiaper(babyId, {
        type,
        notes: notes || undefined,
        changed_at: new Date(changedAt).toISOString(),
      });
      setDiapers([diaper, ...diapers]);
      setShowForm(false);
      setType('pee');
      setNotes('');
      setChangedAt(getCurrentDateTime());
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (diaperId) => {
    if (confirmDeleteId !== diaperId) {
      setConfirmDeleteId(diaperId);
      return;
    }
    try {
      await deleteDiaper(babyId, diaperId);
      setDiapers(diapers.filter((d) => d.id !== diaperId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (d) => {
    setEditingDiaper(d);
    setEditType(d.type);
    setEditNotes(d.notes || '');
    const date = new Date(d.changed_at);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    setEditChangedAt(local.toISOString().slice(0, 16));
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      const updated = await updateDiaper(babyId, editingDiaper.id, {
        type: editType,
        notes: editNotes || null,
        changed_at: new Date(editChangedAt).toISOString(),
      });
      setDiapers(diapers.map((d) => (d.id === updated.id ? updated : d)));
      setEditingDiaper(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const diaperEmoji = (type) => {
    if (type === 'pee') return '💧';
    if (type === 'poop') return '💩';
    return '💧💩';
  };

  return (
    <div>
      {!showForm ? (
        <button className="btn-primary btn-full" onClick={() => { setChangedAt(getCurrentDateTime()); setShowForm(true); }}>
          + Log Diaper Change
        </button>
      ) : (
        <div className="card mt-16">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="changed-at">Date & Time</label>
              <input
                id="changed-at"
                type="datetime-local"
                value={changedAt}
                onChange={(e) => setChangedAt(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Type</label>
              <div className="radio-group">
                {['pee', 'poop', 'both'].map((t) => (
                  <label key={t} className="radio-option">
                    <input type="radio" name="diaper-type" value={t} checked={type === t} onChange={() => setType(t)} />
                    {t === 'pee' ? '💧 Pee' : t === 'poop' ? '💩 Poop' : '💧💩 Both'}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="diaper-notes">Notes (optional)</label>
              <input
                id="diaper-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes..."
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className="form-actions">
              <button type="submit" className="btn-success">Save</button>
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setNotes(''); setChangedAt(getCurrentDateTime()); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Diaper list */}
      <div className="card mt-16">
        <div className="section-header">
          <h3>Recent Diaper Changes</h3>
        </div>
        {diapers.length === 0 ? (
          <p className="text-muted text-sm">No diaper changes recorded yet</p>
        ) : (
          diapers.map((d) => (
            <div key={d.id} className="entry-item">
              <div className="entry-info">
                <h4>{diaperEmoji(d.type)} {d.type.charAt(0).toUpperCase() + d.type.slice(1)}</h4>
                <p>{formatTime(d.changed_at)}{d.notes ? ` — ${d.notes}` : ''}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="btn-outline btn-sm" onClick={() => startEdit(d)}>Edit</button>
                {confirmDeleteId === d.id ? (
                  <>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(d.id)}>
                      Delete
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="delete-btn" onClick={() => handleDelete(d.id)} aria-label="Delete diaper record">
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editingDiaper} onClose={() => setEditingDiaper(null)} title="Edit Diaper Change">
        {editingDiaper && (
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" value={editChangedAt} onChange={(e) => setEditChangedAt(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <div className="radio-group">
                {['pee', 'poop', 'both'].map((t) => (
                  <label key={t} className="radio-option">
                    <input type="radio" name="edit-diaper-type" value={t} checked={editType === t} onChange={() => setEditType(t)} />
                    {t === 'pee' ? '💧 Pee' : t === 'poop' ? '💩 Poop' : '💧💩 Both'}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Any notes..." />
            </div>
            {editError && <p className="error-msg">{editError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-success">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingDiaper(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
