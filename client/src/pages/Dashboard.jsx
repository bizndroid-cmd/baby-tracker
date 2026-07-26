import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBabies, createBaby } from '../api';
import FeedingPanel from '../components/FeedingPanel';
import DiaperPanel from '../components/DiaperPanel';
import SleepPanel from '../components/SleepPanel';
import StatsPanel from '../components/StatsPanel';
import ManageProfiles from '../components/ManageProfiles';
import Modal from '../components/Modal';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'feeding', label: '🍼 Feeding' },
  { id: 'diaper', label: '🧷 Diaper' },
  { id: 'sleep', label: '😴 Sleep' },
  { id: 'profiles', label: '⚙️ Profiles' },
];

export default function Dashboard({ user, onLogout }) {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = TABS.find((t) => t.id === tab)?.id || 'dashboard';

  const [babies, setBabies] = useState([]);
  const [selectedBaby, setSelectedBaby] = useState(null);
  const [showAddBaby, setShowAddBaby] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [newBabyDob, setNewBabyDob] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBabies();
  }, []);

  useEffect(() => {
    if (!tab) navigate('/dashboard', { replace: true });
  }, [tab]);

  const loadBabies = async () => {
    try {
      const data = await getBabies();
      const list = data || [];
      setBabies(list);
      if (list.length > 0 && !selectedBaby) {
        setSelectedBaby(list[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddBaby = async (e) => {
    e.preventDefault();
    if (!newBabyName.trim()) return;
    try {
      const baby = await createBaby(newBabyName.trim(), newBabyDob || null);
      setBabies([baby, ...babies]);
      setSelectedBaby(baby);
      setNewBabyName('');
      setNewBabyDob('');
      setShowAddBaby(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProfileUpdate = (updated) => {
    setBabies(babies.map((b) => (b.id === updated.id ? updated : b)));
    if (selectedBaby?.id === updated.id) setSelectedBaby(updated);
  };

  const handleProfileDelete = (id) => {
    const remaining = babies.filter((b) => b.id !== id);
    setBabies(remaining);
    if (selectedBaby?.id === id) {
      setSelectedBaby(remaining[0] || null);
    }
  };

  const switchTab = (tabId) => {
    navigate(`/${tabId}`);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <nav className="nav">
        <div className="nav-left">
          <h1>🍼 Baby Tracker</h1>
        </div>
        <div className="nav-actions">
          {babies.length > 1 && (
            <select
              className="baby-select-inline"
              value={selectedBaby?.id || ''}
              onChange={(e) => setSelectedBaby(babies.find((b) => b.id === e.target.value))}
              aria-label="Select baby"
            >
              {babies.map((baby) => (
                <option key={baby.id} value={baby.id}>{baby.name}</option>
              ))}
            </select>
          )}
          <button className="btn-outline btn-sm" onClick={() => setShowAddBaby(true)}>
            + Baby
          </button>
          <span className="nav-user">{user.name}</span>
          <button className="btn-secondary btn-sm" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Page Title */}
      {selectedBaby && (
        <div className="page-header">
          <h2>{selectedBaby.name}'s Tracker</h2>
        </div>
      )}

      {/* Tabs */}
      {selectedBaby && (
        <div className="container">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => switchTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panels */}
          {activeTab === 'dashboard' && <StatsPanel babyId={selectedBaby.id} />}
          {activeTab === 'feeding' && <FeedingPanel babyId={selectedBaby.id} />}
          {activeTab === 'diaper' && <DiaperPanel babyId={selectedBaby.id} />}
          {activeTab === 'sleep' && <SleepPanel babyId={selectedBaby.id} />}
          {activeTab === 'profiles' && (
            <ManageProfiles
              babies={babies}
              onUpdate={handleProfileUpdate}
              onDelete={handleProfileDelete}
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {babies.length === 0 && (
        <div className="container">
          <div className="empty-state">
            <div className="emoji">👶</div>
            <p>Add a baby profile to start tracking</p>
            <button className="btn-primary mt-16" onClick={() => setShowAddBaby(true)}>
              + Add Your Baby
            </button>
          </div>
        </div>
      )}

      {/* Show profiles tab even without baby selected */}
      {babies.length === 0 && activeTab === 'profiles' && (
        <div className="container">
          <ManageProfiles babies={babies} onUpdate={handleProfileUpdate} onDelete={handleProfileDelete} />
        </div>
      )}

      {error && (
        <div className="container">
          <p className="error-msg">{error}</p>
        </div>
      )}

      {/* Add Baby Modal */}
      <Modal open={showAddBaby} onClose={() => setShowAddBaby(false)} title="Add Baby">
        <form onSubmit={handleAddBaby}>
          <div className="form-group">
            <label htmlFor="baby-name">Baby Name</label>
            <input
              id="baby-name"
              type="text"
              value={newBabyName}
              onChange={(e) => setNewBabyName(e.target.value)}
              placeholder="Baby's name"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="baby-dob">Date of Birth (optional)</label>
            <input
              id="baby-dob"
              type="date"
              value={newBabyDob}
              onChange={(e) => setNewBabyDob(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-success">Save</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAddBaby(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
