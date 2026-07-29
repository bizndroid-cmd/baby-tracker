const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get feeding stats for a baby
router.get('/feedings/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const days = parseInt(req.query.days) || 7;
    const from = req.query.from || null;
    const to = req.query.to || null;

    let dateFilter;
    let params;

    if (from && to) {
      dateFilter = "AND fed_at >= ? AND fed_at < datetime(?, '+1 day')";
      params = [req.params.babyId, req.user.id, from, to];
    } else {
      dateFilter = "AND fed_at >= datetime('now', ?)";
      params = [req.params.babyId, req.user.id, `-${days} days`];
    }

    const dailyStats = db.prepare(`
      SELECT 
        date(fed_at, 'localtime') as date,
        COUNT(*) as total_feeds,
        SUM(CASE WHEN type = 'breast' THEN 1 ELSE 0 END) as breast_count,
        SUM(CASE WHEN type = 'pumped' THEN 1 ELSE 0 END) as pumped_count,
        SUM(CASE WHEN type = 'formula' THEN 1 ELSE 0 END) as formula_count,
        SUM(CASE WHEN type = 'breast' THEN duration_minutes ELSE 0 END) as total_breast_minutes,
        SUM(CASE WHEN type IN ('pumped', 'formula') THEN COALESCE(quantity_ml, quantity_oz * 29.5735) ELSE 0 END) as total_ml
      FROM feedings
      WHERE baby_id = ? AND user_id = ? ${dateFilter}
      GROUP BY date(fed_at, 'localtime')
      ORDER BY date(fed_at, 'localtime') DESC
    `).all(...params);

    const numDays = dailyStats.length || 1;
    const totals = dailyStats.reduce((acc, day) => {
      acc.feeds += day.total_feeds;
      acc.breast_minutes += day.total_breast_minutes;
      acc.ml += day.total_ml;
      acc.breast_count += day.breast_count;
      acc.pumped_count += day.pumped_count;
      acc.formula_count += day.formula_count;
      return acc;
    }, { feeds: 0, breast_minutes: 0, ml: 0, breast_count: 0, pumped_count: 0, formula_count: 0 });

    const averages = {
      feeds_per_day: Math.round((totals.feeds / numDays) * 10) / 10,
      breast_minutes_per_day: Math.round((totals.breast_minutes / numDays) * 10) / 10,
      ml_per_day: Math.round((totals.ml / numDays) * 10) / 10,
      oz_per_day: Math.round((totals.ml / numDays / 29.5735) * 10) / 10,
    };

    res.json({
      period: { days: numDays, from: dailyStats[dailyStats.length - 1]?.date, to: dailyStats[0]?.date },
      averages,
      totals,
      daily: dailyStats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feeding stats' });
  }
});

// Get sleep stats for a baby
router.get('/sleep/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const days = parseInt(req.query.days) || 7;
    const from = req.query.from || null;
    const to = req.query.to || null;

    let dateFilter;
    let params;

    if (from && to) {
      dateFilter = "AND start_time >= ? AND start_time < datetime(?, '+1 day')";
      params = [req.params.babyId, req.user.id, from, to];
    } else {
      dateFilter = "AND start_time >= datetime('now', ?)";
      params = [req.params.babyId, req.user.id, `-${days} days`];
    }

    const dailyStats = db.prepare(`
      SELECT 
        date(start_time, 'localtime') as date,
        COUNT(*) as session_count,
        SUM(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes ELSE 0 END) as total_minutes
      FROM sleep
      WHERE baby_id = ? AND user_id = ? ${dateFilter}
      GROUP BY date(start_time, 'localtime')
      ORDER BY date(start_time, 'localtime') DESC
    `).all(...params);

    const numDays = dailyStats.length || 1;
    const totals = dailyStats.reduce((acc, day) => {
      acc.sessions += day.session_count;
      acc.minutes += day.total_minutes;
      return acc;
    }, { sessions: 0, minutes: 0 });

    const averages = {
      minutes_per_day: Math.round((totals.minutes / numDays) * 10) / 10,
      sessions_per_day: Math.round((totals.sessions / numDays) * 10) / 10,
    };

    res.json({
      period: { days: numDays, from: dailyStats[dailyStats.length - 1]?.date, to: dailyStats[0]?.date },
      averages,
      totals,
      daily: dailyStats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sleep stats' });
  }
});

// Get diaper stats for a baby
router.get('/diapers/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const days = parseInt(req.query.days) || 7;
    const from = req.query.from || null;
    const to = req.query.to || null;

    let dateFilter;
    let params;

    if (from && to) {
      dateFilter = "AND changed_at >= ? AND changed_at < datetime(?, '+1 day')";
      params = [req.params.babyId, req.user.id, from, to];
    } else {
      dateFilter = "AND changed_at >= datetime('now', ?)";
      params = [req.params.babyId, req.user.id, `-${days} days`];
    }

    const dailyStats = db.prepare(`
      SELECT 
        date(changed_at, 'localtime') as date,
        COUNT(*) as total_changes,
        SUM(CASE WHEN type = 'pee' THEN 1 ELSE 0 END) as pee_count,
        SUM(CASE WHEN type = 'poop' THEN 1 ELSE 0 END) as poop_count,
        SUM(CASE WHEN type = 'both' THEN 1 ELSE 0 END) as both_count
      FROM diapers
      WHERE baby_id = ? AND user_id = ? ${dateFilter}
      GROUP BY date(changed_at, 'localtime')
      ORDER BY date(changed_at, 'localtime') DESC
    `).all(...params);

    const numDays = dailyStats.length || 1;
    const totals = dailyStats.reduce((acc, day) => {
      acc.changes += day.total_changes;
      acc.pee += day.pee_count;
      acc.poop += day.poop_count;
      acc.both += day.both_count;
      return acc;
    }, { changes: 0, pee: 0, poop: 0, both: 0 });

    const averages = {
      changes_per_day: Math.round((totals.changes / numDays) * 10) / 10,
      pee_per_day: Math.round(((totals.pee + totals.both) / numDays) * 10) / 10,
      poop_per_day: Math.round(((totals.poop + totals.both) / numDays) * 10) / 10,
    };

    res.json({
      period: { days: numDays, from: dailyStats[dailyStats.length - 1]?.date, to: dailyStats[0]?.date },
      averages,
      totals,
      daily: dailyStats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diaper stats' });
  }
});

module.exports = router;
