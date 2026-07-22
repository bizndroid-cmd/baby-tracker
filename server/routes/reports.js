const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// RFC 4180 CSV field escaping
function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields) {
  return fields.map(csvField).join(',');
}

// GET /:babyId - Download CSV report
router.get('/:babyId', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.babyId, req.user.id);
    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const days = req.query.days ? parseInt(req.query.days) : null;

    let dateFilter = '';
    let feedingParams = [req.params.babyId, req.user.id];
    let diaperParams = [req.params.babyId, req.user.id];
    let sleepParams = [req.params.babyId, req.user.id];

    if (days) {
      const filterStr = `-${days} days`;
      dateFilter = "AND fed_at >= datetime('now', ?)";
      feedingParams.push(filterStr);

      diaperParams.push(filterStr);
      sleepParams.push(filterStr);
    }

    // Fetch data
    const feedings = db.prepare(
      `SELECT * FROM feedings WHERE baby_id = ? AND user_id = ? ${days ? "AND fed_at >= datetime('now', ?)" : ''} ORDER BY fed_at DESC`
    ).all(...feedingParams);

    const diapers = db.prepare(
      `SELECT * FROM diapers WHERE baby_id = ? AND user_id = ? ${days ? "AND changed_at >= datetime('now', ?)" : ''} ORDER BY changed_at DESC`
    ).all(...diaperParams);

    const sleepRecords = db.prepare(
      `SELECT * FROM sleep WHERE baby_id = ? AND user_id = ? ${days ? "AND start_time >= datetime('now', ?)" : ''} ORDER BY start_time DESC`
    ).all(...sleepParams);

    // Build CSV
    const lines = [];

    // Feedings section
    lines.push('Section: Feedings');
    lines.push(csvRow(['date', 'type', 'duration_minutes', 'quantity_ml', 'quantity_oz', 'side', 'notes']));
    for (const f of feedings) {
      lines.push(csvRow([f.fed_at, f.type, f.duration_minutes, f.quantity_ml, f.quantity_oz, f.side, f.notes]));
    }

    lines.push(''); // empty row separator

    // Diapers section
    lines.push('Section: Diapers');
    lines.push(csvRow(['date', 'type', 'notes']));
    for (const d of diapers) {
      lines.push(csvRow([d.changed_at, d.type, d.notes]));
    }

    lines.push(''); // empty row separator

    // Sleep section
    lines.push('Section: Sleep');
    lines.push(csvRow(['start_time', 'end_time', 'duration_minutes', 'notes']));
    for (const s of sleepRecords) {
      lines.push(csvRow([s.start_time, s.end_time, s.duration_minutes, s.notes]));
    }

    const csv = lines.join('\r\n') + '\r\n';

    // Determine date range for filename
    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);
    let startDate;
    if (days) {
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      startDate = start.toISOString().slice(0, 10);
    } else {
      startDate = 'all';
    }

    const safeName = baby.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}_${startDate}_${endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
