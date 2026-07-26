import React, { useState, useEffect } from 'react';
import { getFeedings, addFeeding, deleteFeeding, updateFeeding } from '../api';
import Modal from './Modal';

function getCurrentDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function FeedingPanel({ babyId }) {
  const [feedings, setFeedings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Edit state
  const [editingFeeding, setEditingFeeding] = useState(null);
  const [editType, setEditType] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editMl, setEditMl] = useState('');
  const [editOz, setEditOz] = useState('');
  const [editSide, setEditSide] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFedAt, setEditFedAt] = useState('');
  const [editError, setEditError] = useState('');

  // Form fields
  const [fedAt, setFedAt] = useState(getCurrentDateTime());
  const [enableBreast, setEnableBreast] = useState(false);
  const [enablePumped, setEnablePumped] = useState(false);
  const [enableFormula, setEnableFormula] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [side, setSide] = useState('');
  const [pumpedMl, setPumpedMl] = useState('');
  const [pumpedOz, setPumpedOz] = useState('');
  const [formulaMl, setFormulaMl] = useState('');
  const [formulaOz, setFormulaOz] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadFeedings();
  }, [babyId]);

  const loadFeedings = async () => {
    try {
      const data = await getFeedings(babyId);
      setFeedings(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!enableBreast && !enablePumped && !enableFormula) {
      setError('Select at least one feeding type');
      return;
    }

    const timestamp = new Date(fedAt).toISOString();
    const entries = [];

    if (enableBreast) {
      if (!durationMinutes) {
        setError('Duration is required for breastfeeding');
        return;
      }
      entries.push({
        type: 'breast',
        duration_minutes: parseInt(durationMinutes),
        side: side || undefined,
        notes: notes || undefined,
        fed_at: timestamp,
      });
    }

    if (enablePumped) {
      if (!pumpedMl && !pumpedOz) {
        setError('Quantity is required for pumped milk');
        return;
      }
      entries.push({
        type: 'pumped',
        quantity_ml: pumpedMl ? parseFloat(pumpedMl) : undefined,
        quantity_oz: pumpedOz ? parseFloat(pumpedOz) : undefined,
        notes: notes || undefined,
        fed_at: timestamp,
      });
    }

    if (enableFormula) {
      if (!formulaMl && !formulaOz) {
        setError('Quantity is required for formula');
        return;
      }
      entries.push({
        type: 'formula',
        quantity_ml: formulaMl ? parseFloat(formulaMl) : undefined,
        quantity_oz: formulaOz ? parseFloat(formulaOz) : undefined,
        notes: notes || undefined,
        fed_at: timestamp,
      });
    }

    try {
      const newFeedings = [];
      for (const entry of entries) {
        const feeding = await addFeeding(babyId, entry);
        newFeedings.push(feeding);
      }
      setFeedings([...newFeedings.reverse(), ...feedings]);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (feedingId) => {
    if (confirmDeleteId !== feedingId) {
      setConfirmDeleteId(feedingId);
      return;
    }
    try {
      await deleteFeeding(babyId, feedingId);
      setFeedings(feedings.filter((f) => f.id !== feedingId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (f) => {
    setEditingFeeding(f);
    setEditType(f.type);
    setEditDuration(f.duration_minutes || '');
    setEditMl(f.quantity_ml || '');
    setEditOz(f.quantity_oz || '');
    setEditSide(f.side || '');
    setEditNotes(f.notes || '');
    // Convert ISO to datetime-local format
    const d = new Date(f.fed_at);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    setEditFedAt(local.toISOString().slice(0, 16));
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      const data = {
        type: editType,
        fed_at: new Date(editFedAt).toISOString(),
        notes: editNotes || null,
        duration_minutes: editType === 'breast' ? parseInt(editDuration) || null : null,
        quantity_ml: (editType === 'pumped' || editType === 'formula') ? parseFloat(editMl) || null : null,
        quantity_oz: (editType === 'pumped' || editType === 'formula') ? parseFloat(editOz) || null : null,
        side: editType === 'breast' ? editSide || null : null,
      };
      const updated = await updateFeeding(babyId, editingFeeding.id, data);
      setFeedings(feedings.map((f) => (f.id === updated.id ? updated : f)));
      setEditingFeeding(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEnableBreast(false);
    setEnablePumped(false);
    setEnableFormula(false);
    setDurationMinutes('');
    setSide('');
    setPumpedMl('');
    setPumpedOz('');
    setFormulaMl('');
    setFormulaOz('');
    setNotes('');
    setFedAt(getCurrentDateTime());
    setError('');
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

  const feedingLabel = (f) => {
    if (f.type === 'breast') {
      return `🤱 Breastfeed — ${f.duration_minutes} min${f.side ? ` (${f.side})` : ''}`;
    }
    const qty = f.quantity_ml ? `${f.quantity_ml} ml` : `${f.quantity_oz} oz`;
    const icon = f.type === 'pumped' ? '🍼' : '🧴';
    return `${icon} ${f.type === 'pumped' ? 'Pumped' : 'Formula'} — ${qty}`;
  };

  return (
    <div>
      {!showForm ? (
        <button className="btn-primary btn-full" onClick={() => { setFedAt(getCurrentDateTime()); setShowForm(true); }}>
          + Log Feeding
        </button>
      ) : (
        <div className="card mt-16">
          <form onSubmit={handleSubmit}>
            {/* Date & Time */}
            <div className="form-group">
              <label htmlFor="fed-at">Date & Time</label>
              <input
                id="fed-at"
                type="datetime-local"
                value={fedAt}
                onChange={(e) => setFedAt(e.target.value)}
                required
              />
            </div>

            {/* Feeding Type Selection - Multi-select */}
            <div className="form-group">
              <label>Feeding Types (select all that apply)</label>
              <div className="toggle-group">
                <label className={`toggle-chip ${enableBreast ? 'active' : ''}`}>
                  <input type="checkbox" checked={enableBreast} onChange={() => setEnableBreast(!enableBreast)} />
                  🤱 Breastfeed
                </label>
                <label className={`toggle-chip ${enablePumped ? 'active' : ''}`}>
                  <input type="checkbox" checked={enablePumped} onChange={() => setEnablePumped(!enablePumped)} />
                  🍼 Pumped
                </label>
                <label className={`toggle-chip ${enableFormula ? 'active' : ''}`}>
                  <input type="checkbox" checked={enableFormula} onChange={() => setEnableFormula(!enableFormula)} />
                  🧴 Formula
                </label>
              </div>
            </div>

            {/* Breastfeed section */}
            {enableBreast && (
              <div className="form-section">
                <div className="form-section-title">🤱 Breastfeed Details</div>
                <div className="form-group">
                  <label htmlFor="duration">Duration (minutes)</label>
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="e.g. 15"
                    required={enableBreast}
                  />
                </div>
                <div className="form-group">
                  <label>Side</label>
                  <div className="radio-group">
                    {['left', 'right', 'both'].map((s) => (
                      <label key={s} className="radio-option">
                        <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pumped section */}
            {enablePumped && (
              <div className="form-section">
                <div className="form-section-title">🍼 Pumped Milk</div>
                <div className="form-group">
                  <label htmlFor="pumped-ml">Quantity (ml)</label>
                  <input
                    id="pumped-ml"
                    type="number"
                    min="0"
                    step="0.1"
                    value={pumpedMl}
                    onChange={(e) => {
                      setPumpedMl(e.target.value);
                      if (e.target.value) setPumpedOz((parseFloat(e.target.value) / 29.5735).toFixed(1));
                      else setPumpedOz('');
                    }}
                    placeholder="e.g. 120"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pumped-oz">Quantity (oz)</label>
                  <input
                    id="pumped-oz"
                    type="number"
                    min="0"
                    step="0.1"
                    value={pumpedOz}
                    onChange={(e) => {
                      setPumpedOz(e.target.value);
                      if (e.target.value) setPumpedMl((parseFloat(e.target.value) * 29.5735).toFixed(0));
                      else setPumpedMl('');
                    }}
                    placeholder="e.g. 4"
                  />
                </div>
              </div>
            )}

            {/* Formula section */}
            {enableFormula && (
              <div className="form-section">
                <div className="form-section-title">🧴 Formula</div>
                <div className="form-group">
                  <label htmlFor="formula-ml">Quantity (ml)</label>
                  <input
                    id="formula-ml"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formulaMl}
                    onChange={(e) => {
                      setFormulaMl(e.target.value);
                      if (e.target.value) setFormulaOz((parseFloat(e.target.value) / 29.5735).toFixed(1));
                      else setFormulaOz('');
                    }}
                    placeholder="e.g. 60"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="formula-oz">Quantity (oz)</label>
                  <input
                    id="formula-oz"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formulaOz}
                    onChange={(e) => {
                      setFormulaOz(e.target.value);
                      if (e.target.value) setFormulaMl((parseFloat(e.target.value) * 29.5735).toFixed(0));
                      else setFormulaMl('');
                    }}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">Notes (optional)</label>
              <input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this session..."
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className="form-actions">
              <button type="submit" className="btn-success">Save Feeding</button>
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Feeding list */}
      <div className="card mt-16">
        <div className="section-header">
          <h3>Recent Feedings</h3>
        </div>
        {feedings.length === 0 ? (
          <p className="text-muted text-sm">No feedings recorded yet</p>
        ) : (
          feedings.map((f) => (
            <div key={f.id} className="entry-item">
              <div className="entry-info">
                <h4>{feedingLabel(f)}</h4>
                <p>{formatTime(f.fed_at)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="btn-outline btn-sm" onClick={() => startEdit(f)}>Edit</button>
                {confirmDeleteId === f.id ? (
                  <>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(f.id)}>
                      Delete
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="delete-btn" onClick={() => handleDelete(f.id)} aria-label="Delete feeding">
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editingFeeding} onClose={() => setEditingFeeding(null)} title="Edit Feeding">
        {editingFeeding && (
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" value={editFedAt} onChange={(e) => setEditFedAt(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                <option value="breast">Breastfeed</option>
                <option value="pumped">Pumped</option>
                <option value="formula">Formula</option>
              </select>
            </div>
            {editType === 'breast' && (
              <>
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input type="number" min="1" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Side</label>
                  <select value={editSide} onChange={(e) => setEditSide(e.target.value)}>
                    <option value="">None</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </>
            )}
            {(editType === 'pumped' || editType === 'formula') && (
              <>
                <div className="form-group">
                  <label>Quantity (ml)</label>
                  <input type="number" min="0" step="0.1" value={editMl} onChange={(e) => { setEditMl(e.target.value); if (e.target.value) setEditOz((parseFloat(e.target.value)/29.5735).toFixed(1)); else setEditOz(''); }} />
                </div>
                <div className="form-group">
                  <label>Quantity (oz)</label>
                  <input type="number" min="0" step="0.1" value={editOz} onChange={(e) => { setEditOz(e.target.value); if (e.target.value) setEditMl((parseFloat(e.target.value)*29.5735).toFixed(0)); else setEditMl(''); }} />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Notes</label>
              <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            {editError && <p className="error-msg">{editError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn-success">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingFeeding(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
