const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get feedings for a baby
router.get('/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const feedings = db.prepare(
      'SELECT * FROM feedings WHERE baby_id = ? AND user_id = ? ORDER BY fed_at DESC LIMIT ? OFFSET ?'
    ).all(req.params.babyId, req.user.id, limit, offset);

    res.json(feedings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedings' });
  }
});

// Add a feeding
router.post('/:babyId', (req, res) => {
  try {
    const { type, duration_minutes, quantity_ml, quantity_oz, side, notes, fed_at } = req.body;

    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    if (!type || !['breast', 'pumped', 'formula'].includes(type)) {
      return res.status(400).json({ error: 'Valid feeding type is required (breast, pumped, formula)' });
    }

    if (type === 'breast' && !duration_minutes) {
      return res.status(400).json({ error: 'Duration is required for breastfeeding' });
    }

    if ((type === 'pumped' || type === 'formula') && !quantity_ml && !quantity_oz) {
      return res.status(400).json({ error: 'Quantity (ml or oz) is required for pumped/formula feeding' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO feedings (id, baby_id, user_id, type, duration_minutes, quantity_ml, quantity_oz, side, notes, fed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.babyId, req.user.id, type, duration_minutes || null, quantity_ml || null, quantity_oz || null, side || null, notes || null, fed_at || new Date().toISOString());

    const feeding = db.prepare('SELECT * FROM feedings WHERE id = ?').get(id);
    res.status(201).json(feeding);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Invalid baby or user reference' });
    }
    res.status(500).json({ error: 'Failed to add feeding' });
  }
});

// Delete a feeding
router.delete('/:babyId/:feedingId', (req, res) => {
  try {
    const feeding = db.prepare('SELECT * FROM feedings WHERE id = ? AND baby_id = ? AND user_id = ?').get(
      req.params.feedingId, req.params.babyId, req.user.id
    );

    if (!feeding) {
      return res.status(404).json({ error: 'Feeding not found' });
    }

    db.prepare('DELETE FROM feedings WHERE id = ?').run(req.params.feedingId);
    res.json({ message: 'Feeding deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete feeding' });
  }
});

module.exports = router;
