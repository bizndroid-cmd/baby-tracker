const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const authRoutes = require('./routes/auth');
const babyRoutes = require('./routes/babies');
const feedingRoutes = require('./routes/feedings');
const diaperRoutes = require('./routes/diapers');
const sleepRoutes = require('./routes/sleep');
const statsRoutes = require('./routes/stats');
const reportRoutes = require('./routes/reports');
const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/babies', babyRoutes);
app.use('/api/feedings', feedingRoutes);
app.use('/api/diapers', diaperRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the existing process or use a different port:`);
    console.error(`  lsof -ti :${PORT} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
});
