const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get all activity (feedings + diapers + sleep) for a baby within timeframe
router.get('/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const days = parseInt(req.query.days) || 7;
    const dateFilter = `-${days} days`;

    const feedings = db.prepare(`
      SELECT id, 'feeding' as category, type, duration_minutes, quantity_ml, quantity_oz, side, notes, fed_at as timestamp
      FROM feedings WHERE baby_id = ? AND user_id = ? AND fed_at >= datetime('now', ?)
      ORDER BY fed_at DESC
    `).all(req.params.babyId, req.user.id, dateFilter);

    const diapers = db.prepare(`
      SELECT id, 'diaper' as category, type, notes, changed_at as timestamp
      FROM diapers WHERE baby_id = ? AND user_id = ? AND changed_at >= datetime('now', ?)
      ORDER BY changed_at DESC
    `).all(req.params.babyId, req.user.id, dateFilter);

    const sleepRecords = db.prepare(`
      SELECT id, 'sleep' as category, start_time as timestamp, end_time, duration_minutes, notes
      FROM sleep WHERE baby_id = ? AND user_id = ? AND start_time >= datetime('now', ?)
      ORDER BY start_time DESC
    `).all(req.params.babyId, req.user.id, dateFilter);

    // Merge and sort by timestamp descending
    const all = [...feedings, ...diapers, ...sleepRecords].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;
