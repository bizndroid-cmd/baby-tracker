import React, { useState } from 'react';
import { updateBaby, deleteBaby } from '../api';
import Modal from './Modal';

export default function ManageProfiles({ babies, onUpdate, onDelete }) {
  const [editingBaby, setEditingBaby] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState('');

  const startEdit = (baby) => {
    setEditingBaby(baby);
    setEditName(baby.name);
    setEditDob(baby.date_of_birth || '');
    setError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setError('');
    try {
      const updated = await updateBaby(editingBaby.id, {
        name: editName.trim(),
        date_of_birth: editDob || null,
      });
      onUpdate(updated);
      setEditingBaby(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await deleteBaby(id);
      onDelete(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h3>Baby Profiles</h3>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {babies.length === 0 ? (
          <p className="text-muted text-sm">No profiles yet</p>
        ) : (
          babies.map((baby) => (
            <div key={baby.id} className="profile-item">
              <div className="profile-info">
                <h4>👶 {baby.name}</h4>
                <p>{baby.date_of_birth ? `Born: ${baby.date_of_birth}` : 'No DOB set'}</p>
              </div>
              <div className="profile-actions">
                {confirmDeleteId === baby.id ? (
                  <>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(baby.id)}>
                      Confirm Delete
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-outline btn-sm" onClick={() => startEdit(baby)}>
                      Edit
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(baby.id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editingBaby} onClose={() => setEditingBaby(null)} title="Edit Baby Profile">
        <form onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label htmlFor="edit-name">Baby Name</label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-dob">Date of Birth</label>
            <input
              id="edit-dob"
              type="date"
              value={editDob}
              onChange={(e) => setEditDob(e.target.value)}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-success">Save</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingBaby(null)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
