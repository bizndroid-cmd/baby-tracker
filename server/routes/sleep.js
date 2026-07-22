const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get sleep records for a baby
router.get('/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const records = db.prepare(
      'SELECT * FROM sleep WHERE baby_id = ? AND user_id = ? ORDER BY start_time DESC LIMIT ? OFFSET ?'
    ).all(req.params.babyId, req.user.id, limit, offset);

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sleep records' });
  }
});

// Create a sleep record
router.post('/:babyId', (req, res) => {
  try {
    const { start_time, end_time, notes } = req.body;

    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    if (!start_time) {
      return res.status(400).json({ error: 'Start time is required' });
    }

    if (notes && notes.length > 500) {
      return res.status(400).json({ error: 'Notes must be 500 characters or fewer' });
    }

    let duration_minutes = null;

    if (end_time) {
      const start = new Date(start_time);
      const end = new Date(end_time);

      if (end <= start) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      duration_minutes = Math.floor((end - start) / 60000);

      if (duration_minutes > 1440) {
        return res.status(400).json({ error: 'Sleep session duration exceeds maximum allowed (24 hours)' });
      }
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO sleep (id, baby_id, user_id, start_time, end_time, duration_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.babyId, req.user.id, start_time, end_time || null, duration_minutes, notes || null);

    const record = db.prepare('SELECT * FROM sleep WHERE id = ?').get(id);
    res.status(201).json(record);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Invalid baby or user reference' });
    }
    res.status(500).json({ error: 'Failed to create sleep record' });
  }
});

// Update sleep record (end an in-progress session)
router.patch('/:babyId/:sleepId', (req, res) => {
  try {
    const { end_time } = req.body;

    const record = db.prepare('SELECT * FROM sleep WHERE id = ? AND baby_id = ? AND user_id = ?').get(
      req.params.sleepId, req.params.babyId, req.user.id
    );

    if (!record) {
      return res.status(404).json({ error: 'Sleep record not found' });
    }

    if (!end_time) {
      return res.status(400).json({ error: 'End time is required' });
    }

    const start = new Date(record.start_time);
    const end = new Date(end_time);

    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const duration_minutes = Math.floor((end - start) / 60000);

    if (duration_minutes > 1440) {
      return res.status(400).json({ error: 'Sleep session duration exceeds maximum allowed (24 hours)' });
    }

    db.prepare('UPDATE sleep SET end_time = ?, duration_minutes = ? WHERE id = ?').run(end_time, duration_minutes, req.params.sleepId);

    const updated = db.prepare('SELECT * FROM sleep WHERE id = ?').get(req.params.sleepId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update sleep record' });
  }
});

// Delete a sleep record
router.delete('/:babyId/:sleepId', (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM sleep WHERE id = ? AND baby_id = ? AND user_id = ?').get(
      req.params.sleepId, req.params.babyId, req.user.id
    );

    if (!record) {
      return res.status(404).json({ error: 'Sleep record not found' });
    }

    db.prepare('DELETE FROM sleep WHERE id = ?').run(req.params.sleepId);
    res.json({ message: 'Sleep record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete sleep record' });
  }
});

module.exports = router;
