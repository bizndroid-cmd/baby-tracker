const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Get all babies for current user
router.get('/', (req, res) => {
  try {
    const babies = db.prepare('SELECT * FROM babies WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(babies);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch babies' });
  }
});

// Create a baby profile
router.post('/', (req, res) => {
  const { name, date_of_birth } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Baby name is required' });
  }

  try {
    const id = uuidv4();
    db.prepare('INSERT INTO babies (id, user_id, name, date_of_birth) VALUES (?, ?, ?, ?)').run(id, req.user.id, name, date_of_birth || null);
    const baby = db.prepare('SELECT * FROM babies WHERE id = ?').get(id);
    res.status(201).json(baby);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(401).json({ error: 'Account not found. Please log in again.' });
    }
    res.status(500).json({ error: 'Failed to create baby profile' });
  }
});

// Update a baby profile
router.put('/:id', (req, res) => {
  try {
    const { name, date_of_birth } = req.body;
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    db.prepare('UPDATE babies SET name = ?, date_of_birth = ? WHERE id = ?').run(
      name || baby.name,
      date_of_birth !== undefined ? date_of_birth : baby.date_of_birth,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM babies WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update baby profile' });
  }
});

// Delete a baby profile
router.delete('/:id', (req, res) => {
  try {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    db.prepare('DELETE FROM babies WHERE id = ?').run(req.params.id);
    res.json({ message: 'Baby profile deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete baby profile' });
  }
});

module.exports = router;
