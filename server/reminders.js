const db = require('./db');

// In-memory timers (restored from DB on startup)
const activeTimers = new Map(); // key: visitorId, value: { timer, reminder }

let botInstance = null;

function init(bot) {
  botInstance = bot;

  // Create reminders table
  db.exec(`CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    baby_id TEXT NOT NULL,
    type TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL,
    recurring INTEGER DEFAULT 0,
    next_fire TEXT NOT NULL,
    phone TEXT,
    notify_mode TEXT DEFAULT 'telegram',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Restore active reminders from DB
  restoreReminders();
}

function restoreReminders() {
  const reminders = db.prepare('SELECT * FROM reminders WHERE active = 1').all();
  for (const r of reminders) {
    scheduleReminder(r);
  }
  if (reminders.length > 0) {
    console.log(`Restored ${reminders.length} active reminders`);
  }
}

function scheduleReminder(reminder) {
  const now = Date.now();
  const fireAt = new Date(reminder.next_fire).getTime();
  const delay = Math.max(fireAt - now, 1000); // at least 1s

  const timer = setTimeout(() => {
    fireReminder(reminder);
  }, delay);

  activeTimers.set(reminder.id, { timer, reminder });
}

function fireReminder(reminder) {
  const baby = db.prepare('SELECT name FROM babies WHERE id = ?').get(reminder.baby_id);
  const babyName = baby?.name || 'baby';

  const messages = {
    feed: `⏰ Time to feed ${babyName}! Interval: ${formatInterval(reminder.interval_minutes)}`,
    pump: `⏰ Time to pump! Interval: ${formatInterval(reminder.interval_minutes)}`,
    diaper: `⏰ Time to check ${babyName}'s diaper! Interval: ${formatInterval(reminder.interval_minutes)}`,
  };

  const msg = messages[reminder.type] || `⏰ Reminder: ${reminder.type} for ${babyName}`;

  if (reminder.notify_mode === 'call' && reminder.phone) {
    // Twilio voice call (stub — implement when creds available)
    makeVoiceCall(reminder.phone, msg);
    // Also send Telegram as backup
    sendTelegramReminder(reminder.chat_id, msg);
  } else {
    // Default: Telegram notification
    sendTelegramReminder(reminder.chat_id, msg);
  }

  // Handle recurring
  if (reminder.recurring) {
    const nextFire = new Date(Date.now() + reminder.interval_minutes * 60000).toISOString();
    db.prepare('UPDATE reminders SET next_fire = ? WHERE id = ?').run(nextFire, reminder.id);
    reminder.next_fire = nextFire;
    scheduleReminder(reminder);
  } else {
    // One-time, deactivate
    db.prepare('UPDATE reminders SET active = 0 WHERE id = ?').run(reminder.id);
    activeTimers.delete(reminder.id);
  }
}

function sendTelegramReminder(chatId, msg) {
  if (!botInstance) return;
  botInstance.sendMessage(chatId, msg);
}

function makeVoiceCall(phone, message) {
  // STUB: Twilio integration point
  // To activate:
  // 1. npm install twilio
  // 2. Set TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE env vars
  // 3. Uncomment below:
  //
  // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // twilio.calls.create({
  //   twiml: `<Response><Say voice="alice">${message}</Say></Response>`,
  //   to: phone,
  //   from: process.env.TWILIO_PHONE,
  // }).catch(err => console.error('Twilio call failed:', err.message));

  console.log(`[VOICE CALL STUB] Would call ${phone}: "${message}"`);
}

function formatInterval(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// === PUBLIC API ===

function createReminder({ chatId, userId, babyId, type, intervalMinutes, recurring, phone, notifyMode }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const nextFire = new Date(Date.now() + intervalMinutes * 60000).toISOString();

  db.prepare(`INSERT INTO reminders (id, chat_id, user_id, baby_id, type, interval_minutes, recurring, next_fire, phone, notify_mode, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
    id, String(chatId), userId, babyId, type, intervalMinutes, recurring ? 1 : 0, nextFire, phone || null, notifyMode || 'telegram'
  );

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  scheduleReminder(reminder);
  return reminder;
}

function cancelReminders(chatId, type) {
  const reminders = db.prepare('SELECT id FROM reminders WHERE chat_id = ? AND active = 1' + (type ? ' AND type = ?' : '')).all(
    ...(type ? [String(chatId), type] : [String(chatId)])
  );

  for (const r of reminders) {
    const entry = activeTimers.get(r.id);
    if (entry) {
      clearTimeout(entry.timer);
      activeTimers.delete(r.id);
    }
    db.prepare('UPDATE reminders SET active = 0 WHERE id = ?').run(r.id);
  }

  return reminders.length;
}

function getActiveReminders(chatId) {
  return db.prepare('SELECT * FROM reminders WHERE chat_id = ? AND active = 1').all(String(chatId));
}

function setNotifyMode(chatId, mode, phone) {
  // Update all active reminders for this chat to new mode
  db.prepare('UPDATE reminders SET notify_mode = ?, phone = ? WHERE chat_id = ? AND active = 1').run(
    mode, phone || null, String(chatId)
  );
}

module.exports = { init, createReminder, cancelReminders, getActiveReminders, setNotifyMode };
