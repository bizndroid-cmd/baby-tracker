const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get diaper changes for a baby
router.get('/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const diapers = db.prepare(
      'SELECT * FROM diapers WHERE baby_id = ? AND user_id = ? ORDER BY changed_at DESC LIMIT ? OFFSET ?'
    ).all(req.params.babyId, req.user.id, limit, offset);

    res.json(diapers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diapers' });
  }
});

// Add a diaper change
router.post('/:babyId', (req, res) => {
  try {
    const { type, notes, changed_at } = req.body;

    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    if (!type || !['pee', 'poop', 'both'].includes(type)) {
      return res.status(400).json({ error: 'Valid diaper type is required (pee, poop, both)' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO diapers (id, baby_id, user_id, type, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.babyId, req.user.id, type, notes || null, changed_at || new Date().toISOString());

    const diaper = db.prepare('SELECT * FROM diapers WHERE id = ?').get(id);
    res.status(201).json(diaper);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Invalid baby or user reference' });
    }
    res.status(500).json({ error: 'Failed to add diaper change' });
  }
});

// Update a diaper change
router.put('/:babyId/:diaperId', (req, res) => {
  try {
    const { type, notes, changed_at } = req.body;

    const diaper = db.prepare('SELECT * FROM diapers WHERE id = ? AND baby_id = ? AND user_id = ?').get(
      req.params.diaperId, req.params.babyId, req.user.id
    );
    if (!diaper) {
      return res.status(404).json({ error: 'Diaper record not found' });
    }

    const newType = type || diaper.type;
    if (!['pee', 'poop', 'both'].includes(newType)) {
      return res.status(400).json({ error: 'Valid diaper type is required' });
    }

    db.prepare('UPDATE diapers SET type = ?, notes = ?, changed_at = ? WHERE id = ?').run(
      newType,
      notes !== undefined ? notes : diaper.notes,
      changed_at || diaper.changed_at,
      req.params.diaperId
    );

    const updated = db.prepare('SELECT * FROM diapers WHERE id = ?').get(req.params.diaperId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update diaper record' });
  }
});

// Delete a diaper change
router.delete('/:babyId/:diaperId', (req, res) => {
  try {
    const diaper = db.prepare('SELECT * FROM diapers WHERE id = ? AND baby_id = ? AND user_id = ?').get(
      req.params.diaperId, req.params.babyId, req.user.id
    );

    if (!diaper) {
      return res.status(404).json({ error: 'Diaper record not found' });
    }

    db.prepare('DELETE FROM diapers WHERE id = ?').run(req.params.diaperId);
    res.json({ message: 'Diaper record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete diaper record' });
  }
});

module.exports = router;
