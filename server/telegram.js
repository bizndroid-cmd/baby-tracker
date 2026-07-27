const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const tz = require('./timezone');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8818617776:AAH1ToNqkXSaq2gY-msGbd44zyYogRswO94';

let bot;

function startBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  // Initialize reminders system
  const reminders = require('./reminders');
  reminders.init(bot);

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text) return;

    try {
      await handleMessage(chatId, text);
    } catch (err) {
      console.error('Bot error:', err.message);
      bot.sendMessage(chatId, '❌ Something went wrong. Try again.');
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    try {
      await handleCallback(chatId, data);
      bot.answerCallbackQuery(query.id);
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: 'Error' });
    }
  });

  bot.on('polling_error', (err) => {
    if (!err.message.includes('ETELEGRAM: 409')) {
      console.error('Telegram polling error:', err.message);
    }
  });

  console.log('Telegram bot started');
}

async function handleMessage(chatId, text) {
  // Commands
  if (text === '/start') return sendStart(chatId);
  if (text === '/help') return sendHelp(chatId);
  if (text.startsWith('/link')) return handleLink(chatId, text);
  if (text === '/status') return handleStatus(chatId);
  if (text === '/baby') return handleBaby(chatId);
  if (text === '/summary') return handleSummary(chatId);
  if (text === '/last') return handleLast(chatId);
  if (text === '/undo') return handleUndo(chatId);
  if (text.startsWith('/switch')) return handleSwitch(chatId, text);
  if (text === '/quick') return sendQuickButtons(chatId);
  if (text.startsWith('/remind')) return handleRemind(chatId, text);
  if (text === '/reminders') return handleListReminders(chatId);
  if (text.startsWith('/notify')) return handleNotifyMode(chatId, text);

  // Parse natural language entry
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Link account first: /link your@email.com');

  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby profiles. Add one in web app.');

  const result = parseAndSave(text, link.user_id, baby.id);
  if (result) {
    bot.sendMessage(chatId, `✅ ${result}`);
  } else {
    bot.sendMessage(chatId, `❓ Didn't understand: "${text}"\n\nExamples:\n• bf 15 left\n• fed formula 120ml\n• pumped 4oz\n• pee / poop\n• slept 2h 30m\n• nap from 2pm to 3:30pm\n\n/quick for buttons, /help for all commands`);
  }
}

async function handleCallback(chatId, data) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Link account first: /link your@email.com');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby profiles.');

  const result = parseAndSave(data, link.user_id, baby.id);
  if (result) bot.sendMessage(chatId, `✅ ${result}`);
}

function sendStart(chatId) {
  bot.sendMessage(chatId,
    `🍼 *Baby Tracker Bot*\n\n` +
    `Link your account:\n/link your@email.com\n\n` +
    `Then log entries naturally:\n` +
    `• "breastfed 15 min left side"\n` +
    `• "gave formula 120ml"\n` +
    `• "pumped 4oz"\n` +
    `• "poop" or "wet diaper"\n` +
    `• "slept 2 hours"\n` +
    `• "nap from 1pm to 2:30pm"\n\n` +
    `/quick — tap buttons to log\n` +
    `/summary — today's stats\n` +
    `/last — recent entries\n` +
    `/undo — remove last entry`,
    { parse_mode: 'Markdown' }
  );
}

function sendHelp(chatId) {
  bot.sendMessage(chatId,
    `📋 *Commands*\n\n` +
    `🤱 *Feeding:*\n` +
    `• bf 15 left\n• breastfed for 20 minutes right\n` +
    `• formula 120ml\n• gave 4oz formula\n` +
    `• pumped 100ml\n\n` +
    `🧷 *Diaper:*\n• pee / poop / both\n• wet / dirty / mixed\n\n` +
    `😴 *Sleep:*\n• sleep 2h / nap 45m\n• slept 1h 30m\n• nap from 2pm to 3:30pm\n\n` +
    `📊 *Info:*\n• /summary — today's totals\n• /last — last 5 entries\n• /undo — delete last entry\n\n` +
    `⏰ *Reminders:*\n• /remind feed 2.5h — one-time\n• /remind feed every 2.5h — recurring\n• /remind pump every 3h\n• /remind off — cancel all\n• /reminders — list active\n• /notify telegram — message (free)\n• /notify call +1234567890 — voice (premium)\n\n` +
    `⚙️ *Settings:*\n• /link email — connect account\n• /switch babyname — switch active baby\n• /baby — show active baby\n• /quick — quick log buttons`,
    { parse_mode: 'Markdown' }
  );
}

function sendQuickButtons(chatId) {
  bot.sendMessage(chatId, '⚡ Quick log:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🤱 BF Left', callback_data: 'bf 15 left' },
          { text: '🤱 BF Right', callback_data: 'bf 15 right' },
        ],
        [
          { text: '🍼 Formula 60ml', callback_data: 'formula 60ml' },
          { text: '🍼 Formula 120ml', callback_data: 'formula 120ml' },
        ],
        [
          { text: '💧 Pee', callback_data: 'pee' },
          { text: '💩 Poop', callback_data: 'poop' },
          { text: '💧💩 Both', callback_data: 'both' },
        ],
        [
          { text: '😴 Sleep 30m', callback_data: 'sleep 30m' },
          { text: '😴 Sleep 1h', callback_data: 'sleep 1h' },
          { text: '😴 Sleep 2h', callback_data: 'sleep 2h' },
        ],
      ],
    },
  });
}

function handleLink(chatId, text) {
  const email = text.replace('/link', '').trim();
  if (!email || !email.includes('@')) {
    return bot.sendMessage(chatId, '❌ Usage: /link your@email.com');
  }
  const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
  if (!user) {
    return bot.sendMessage(chatId, '❌ No account with that email. Register in web app first.');
  }

  const existing = db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(String(chatId));
  if (existing) {
    db.prepare('UPDATE telegram_links SET user_id = ? WHERE chat_id = ?').run(user.id, String(chatId));
  } else {
    db.prepare('INSERT INTO telegram_links (chat_id, user_id) VALUES (?, ?)').run(String(chatId), user.id);
  }
  bot.sendMessage(chatId, `✅ Linked to: ${user.name} (${email})\n\nSend /quick for quick buttons or type naturally!`);
}

function handleStatus(chatId) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked. /link your@email.com');
  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(link.user_id);
  bot.sendMessage(chatId, `✅ Linked: ${user.name} (${user.email})`);
}

function handleBaby(chatId) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No babies. Add in web app.');
  const all = db.prepare('SELECT name FROM babies WHERE user_id = ?').all(link.user_id);
  bot.sendMessage(chatId, `👶 Active: *${baby.name}*\n\nAll babies: ${all.map(b => b.name).join(', ')}\n\nSwitch: /switch name`, { parse_mode: 'Markdown' });
}

function handleSwitch(chatId, text) {
  const name = text.replace('/switch', '').trim();
  if (!name) return bot.sendMessage(chatId, '❌ Usage: /switch babyname');
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');

  const baby = db.prepare('SELECT * FROM babies WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(link.user_id, name);
  if (!baby) {
    const all = db.prepare('SELECT name FROM babies WHERE user_id = ?').all(link.user_id);
    return bot.sendMessage(chatId, `❌ Baby "${name}" not found.\n\nAvailable: ${all.map(b => b.name).join(', ')}`);
  }

  db.prepare('UPDATE telegram_links SET active_baby_id = ? WHERE chat_id = ?').run(baby.id, String(chatId));
  bot.sendMessage(chatId, `✅ Switched to: ${baby.name}`);
}

function handleSummary(chatId) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby.');

  const today = tz.today();

  const feeds = db.prepare(`SELECT type, COUNT(*) as count, SUM(duration_minutes) as mins, SUM(COALESCE(quantity_ml, quantity_oz*29.5735)) as ml FROM feedings WHERE baby_id = ? AND date(fed_at) = ? GROUP BY type`).all(baby.id, today);
  const diapers = db.prepare(`SELECT type, COUNT(*) as count FROM diapers WHERE baby_id = ? AND date(changed_at) = ? GROUP BY type`).all(baby.id, today);
  const sleeps = db.prepare(`SELECT COUNT(*) as count, SUM(duration_minutes) as mins FROM sleep WHERE baby_id = ? AND date(start_time) = ?`).get(baby.id, today);

  let msg = `📊 *${baby.name} — Today*\n\n`;

  // Feeds
  const totalFeeds = feeds.reduce((s, f) => s + f.count, 0);
  msg += `🍼 *Feeds:* ${totalFeeds}\n`;
  feeds.forEach(f => {
    if (f.type === 'breast') msg += `  🤱 Breast: ${f.count}x (${f.mins || 0} min)\n`;
    else msg += `  ${f.type === 'pumped' ? '🍼' : '🧴'} ${f.type}: ${f.count}x (${Math.round(f.ml || 0)}ml)\n`;
  });

  // Diapers
  const totalDiapers = diapers.reduce((s, d) => s + d.count, 0);
  msg += `\n🧷 *Diapers:* ${totalDiapers}\n`;
  diapers.forEach(d => {
    const emoji = d.type === 'pee' ? '💧' : d.type === 'poop' ? '💩' : '💧💩';
    msg += `  ${emoji} ${d.type}: ${d.count}\n`;
  });

  // Sleep
  msg += `\n😴 *Sleep:* ${sleeps.count || 0} sessions`;
  if (sleeps.mins) {
    const h = Math.floor(sleeps.mins / 60);
    const m = sleeps.mins % 60;
    msg += ` (${h > 0 ? h + 'h ' : ''}${m}m)`;
  }

  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

function handleLast(chatId) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby.');

  const feedings = db.prepare("SELECT *, 'feeding' as cat FROM feedings WHERE baby_id = ? ORDER BY fed_at DESC LIMIT 3").all(baby.id);
  const diapers = db.prepare("SELECT *, 'diaper' as cat FROM diapers WHERE baby_id = ? ORDER BY changed_at DESC LIMIT 3").all(baby.id);
  const sleeps = db.prepare("SELECT *, 'sleep' as cat FROM sleep WHERE baby_id = ? ORDER BY start_time DESC LIMIT 3").all(baby.id);

  const all = [
    ...feedings.map(f => ({ time: f.fed_at, label: formatFeedingLabel(f), cat: 'feeding', id: f.id })),
    ...diapers.map(d => ({ time: d.changed_at, label: formatDiaperLabel(d), cat: 'diaper', id: d.id })),
    ...sleeps.map(s => ({ time: s.start_time, label: formatSleepLabel(s), cat: 'sleep', id: s.id })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

  if (!all.length) return bot.sendMessage(chatId, '📭 No entries yet.');

  let msg = `📋 *Last 5 entries (${baby.name}):*\n\n`;
  all.forEach((entry, i) => {
    const time = new Date(entry.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    msg += `${i + 1}. ${entry.label}\n   _${time}_\n`;
  });

  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

function handleUndo(chatId) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby.');

  // Find most recent entry across all tables
  const lastFeed = db.prepare("SELECT id, fed_at as time, 'feeding' as cat FROM feedings WHERE baby_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1").get(baby.id, link.user_id);
  const lastDiaper = db.prepare("SELECT id, changed_at as time, 'diaper' as cat FROM diapers WHERE baby_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1").get(baby.id, link.user_id);
  const lastSleep = db.prepare("SELECT id, start_time as time, 'sleep' as cat FROM sleep WHERE baby_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1").get(baby.id, link.user_id);

  const candidates = [lastFeed, lastDiaper, lastSleep].filter(Boolean);
  if (!candidates.length) return bot.sendMessage(chatId, '📭 Nothing to undo.');

  // Most recent by created_at implicit (already ordered DESC LIMIT 1)
  // Pick most recent overall
  const last = candidates.sort((a, b) => new Date(b.time) - new Date(a.time))[0];

  if (last.cat === 'feeding') db.prepare('DELETE FROM feedings WHERE id = ?').run(last.id);
  else if (last.cat === 'diaper') db.prepare('DELETE FROM diapers WHERE id = ?').run(last.id);
  else if (last.cat === 'sleep') db.prepare('DELETE FROM sleep WHERE id = ?').run(last.id);

  bot.sendMessage(chatId, `🗑️ Removed last ${last.cat} entry.`);
}

// === REMINDER COMMANDS ===

function handleRemind(chatId, text) {
  const link = getLink(chatId);
  if (!link) return bot.sendMessage(chatId, '❌ Not linked.');
  const baby = getActiveBaby(link.user_id, link.active_baby_id);
  if (!baby) return bot.sendMessage(chatId, '❌ No baby.');

  const reminders = require('./reminders');
  const cmd = text.replace('/remind', '').trim().toLowerCase();

  // /remind off [type]
  if (cmd === 'off' || cmd.startsWith('off')) {
    const type = cmd.replace('off', '').trim() || null;
    const count = reminders.cancelReminders(chatId, type);
    return bot.sendMessage(chatId, count > 0 ? `🔕 Cancelled ${count} reminder(s).` : '📭 No active reminders to cancel.');
  }

  // /remind feed 2.5h / /remind pump 3h / /remind diaper 2h
  const match = cmd.match(/^(feed|pump|diaper)\s+(?:every\s+)?(\d+\.?\d*)\s*(h|hr|hours?|m|min|minutes?)?/);
  if (!match) {
    return bot.sendMessage(chatId,
      '❓ Usage:\n' +
      '• /remind feed 2.5h — one-time\n' +
      '• /remind feed every 2.5h — recurring\n' +
      '• /remind pump 3h\n' +
      '• /remind diaper 2h\n' +
      '• /remind off — cancel all\n' +
      '• /reminders — list active'
    );
  }

  const type = match[1];
  const amount = parseFloat(match[2]);
  const unit = (match[3] || 'h').charAt(0);
  const intervalMinutes = unit === 'h' ? Math.round(amount * 60) : Math.round(amount);
  const recurring = cmd.includes('every');

  reminders.createReminder({
    chatId, userId: link.user_id, babyId: baby.id,
    type, intervalMinutes, recurring,
    phone: null, notifyMode: 'telegram',
  });

  const label = recurring ? `🔔 Recurring: ${type} every ${formatIntervalShort(intervalMinutes)}` : `🔔 Reminder: ${type} in ${formatIntervalShort(intervalMinutes)}`;
  bot.sendMessage(chatId, `${label}\n\nCancel: /remind off`);
}

function handleListReminders(chatId) {
  const reminders = require('./reminders');
  const active = reminders.getActiveReminders(chatId);
  if (!active.length) return bot.sendMessage(chatId, '📭 No active reminders.');

  let msg = '🔔 *Active Reminders:*\n\n';
  active.forEach((r, i) => {
    const next = new Date(r.next_fire).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' });
    const mode = r.notify_mode === 'call' ? '📞' : '💬';
    msg += `${i + 1}. ${mode} ${r.type} — every ${formatIntervalShort(r.interval_minutes)}${r.recurring ? ' (recurring)' : ''}\n   Next: ${next}\n`;
  });
  msg += '\nCancel: /remind off';
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

function handleNotifyMode(chatId, text) {
  const reminders = require('./reminders');
  const cmd = text.replace('/notify', '').trim().toLowerCase();

  if (cmd.startsWith('call')) {
    const phone = cmd.replace('call', '').trim();
    if (!phone || phone.length < 10) {
      return bot.sendMessage(chatId, '❌ Usage: /notify call +1234567890\n\nRequires Twilio setup. Contact admin.');
    }
    reminders.setNotifyMode(chatId, 'call', phone);
    bot.sendMessage(chatId, `📞 Reminder mode: Voice Call to ${phone}\n\n⚠️ Requires Twilio activation. Contact admin if calls not working.`);
  } else if (cmd === 'telegram' || cmd === 'text' || cmd === 'message') {
    reminders.setNotifyMode(chatId, 'telegram', null);
    bot.sendMessage(chatId, '💬 Reminder mode: Telegram message (default)');
  } else {
    bot.sendMessage(chatId, '❓ Usage:\n• /notify telegram — message reminders (free)\n• /notify call +1234567890 — voice call reminders (premium)');
  }
}

function formatIntervalShort(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// === HELPERS ===

function getLink(chatId) {
  try {
    return db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(String(chatId));
  } catch { return null; }
}

function getActiveBaby(userId, activeBabyId) {
  if (activeBabyId) {
    const baby = db.prepare('SELECT * FROM babies WHERE id = ? AND user_id = ?').get(activeBabyId, userId);
    if (baby) return baby;
  }
  return db.prepare('SELECT * FROM babies WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
}

function formatFeedingLabel(f) {
  if (f.type === 'breast') return `🤱 Breast ${f.duration_minutes}min${f.side ? ' (' + f.side + ')' : ''}`;
  const qty = f.quantity_ml ? `${f.quantity_ml}ml` : `${f.quantity_oz}oz`;
  return `${f.type === 'pumped' ? '🍼 Pumped' : '🧴 Formula'} ${qty}`;
}

function formatDiaperLabel(d) {
  const emoji = d.type === 'pee' ? '💧' : d.type === 'poop' ? '💩' : '💧💩';
  return `${emoji} ${d.type}`;
}

function formatSleepLabel(s) {
  if (!s.duration_minutes) return '😴 Sleep (in progress)';
  const h = Math.floor(s.duration_minutes / 60);
  const m = s.duration_minutes % 60;
  return `😴 Sleep ${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`;
}

// === NATURAL LANGUAGE PARSER ===

function parseAndSave(text, userId, babyId) {
  const lower = text.toLowerCase().trim();

  // Try feeding
  const feedResult = tryParseFeed(lower);
  if (feedResult) {
    const id = uuidv4();
    const timestamp = feedResult.time || tz.now();
    db.prepare('INSERT INTO feedings (id, baby_id, user_id, type, duration_minutes, quantity_ml, quantity_oz, side, fed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, babyId, userId, feedResult.type, feedResult.duration || null, feedResult.ml || null, feedResult.oz || null, feedResult.side || null, timestamp
    );
    return feedResult.label;
  }

  // Try diaper
  const diaperResult = tryParseDiaper(lower);
  if (diaperResult) {
    const id = uuidv4();
    const timestamp = diaperResult.time || tz.now();
    db.prepare('INSERT INTO diapers (id, baby_id, user_id, type, changed_at) VALUES (?, ?, ?, ?, ?)').run(
      id, babyId, userId, diaperResult.type, timestamp
    );
    return diaperResult.label;
  }

  // Try sleep
  const sleepResult = tryParseSleep(lower);
  if (sleepResult === 'WAKE' || (sleepResult && sleepResult.wakeTime)) {
    // End last in-progress sleep
    const openSleep = db.prepare('SELECT * FROM sleep WHERE baby_id = ? AND user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1').get(babyId, userId);
    if (!openSleep) return '❌ No active sleep session to end.';
    const endTimeStr = sleepResult.wakeTime || tz.now();
    const endDayjs = tz.dayjs(endTimeStr);
    const startDayjs = tz.dayjs(openSleep.start_time);
    const duration = endDayjs.diff(startDayjs, 'minute');
    db.prepare('UPDATE sleep SET end_time = ?, duration_minutes = ? WHERE id = ?').run(endTimeStr, duration, openSleep.id);
    const h = Math.floor(duration / 60);
    const m = duration % 60;
    return `😴 Sleep ended — ${h > 0 ? h + 'h ' : ''}${m}m total`;
  }
  if (sleepResult) {
    const id = uuidv4();
    db.prepare('INSERT INTO sleep (id, baby_id, user_id, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, babyId, userId, sleepResult.start, sleepResult.end || null, sleepResult.duration || null
    );
    return sleepResult.label;
  }

  return null;
}

function tryParseFeed(text) {
  // Extract optional time ("at 4pm", "at 2:30pm")
  const parsedTime = extractTime(text);

  // Breastfeed patterns
  const bfPatterns = [
    /(?:bf|breast|breastfe[ed]|nursed?|nursing)\s*(?:for\s*)?(\d+)\s*(?:min|minutes?|m)?\s*(left|right|both)?/,
    /(\d+)\s*(?:min|minutes?)\s*(?:bf|breast|breastfe[ed]|nursing)\s*(left|right|both)?/,
    /(?:fed|nurse[d]?)\s*(?:for\s*)?(\d+)\s*(?:min|m)?\s*(left|right|both)?\s*(?:side|breast)?/,
  ];
  for (const pat of bfPatterns) {
    const m = text.match(pat);
    if (m) {
      const mins = parseInt(m[1]);
      const side = m[2] || extractSide(text);
      const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';
      return { type: 'breast', duration: mins, side, time: parsedTime, label: `🤱 Breastfeed ${mins} min${side ? ' (' + side + ')' : ''}${timeLabel} logged` };
    }
  }
  // Simple "bf" without duration defaults to 15
  if (/^(bf|breastfed|nursed|nursing)\s*(left|right|both)?$/.test(text)) {
    const side = text.match(/(left|right|both)/)?.[1] || null;
    return { type: 'breast', duration: 15, side, time: parsedTime, label: `🤱 Breastfeed 15 min${side ? ' (' + side + ')' : ''} logged (default 15min)` };
  }

  // Formula patterns
  const formulaPatterns = [
    /(?:formula|form)\s*(\d+\.?\d*)\s*(ml|oz)/,
    /(?:gave|fed|had)\s*(?:formula|form)\s*(\d+\.?\d*)\s*(ml|oz)/,
    /(\d+\.?\d*)\s*(ml|oz)\s*(?:formula|form)/,
    /(?:gave|fed|had)\s*(\d+\.?\d*)\s*(ml|oz)\s*(?:formula|form)?/,
  ];
  for (const pat of formulaPatterns) {
    const m = text.match(pat);
    if (m && (text.includes('formula') || text.includes('form'))) {
      const qty = parseFloat(m[1]);
      const unit = m[2];
      const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';
      return { type: 'formula', ml: unit === 'ml' ? qty : null, oz: unit === 'oz' ? qty : null, time: parsedTime, label: `🧴 Formula ${qty}${unit}${timeLabel} logged` };
    }
  }

  // Pumped patterns
  const pumpedPatterns = [
    /(?:pumped?|expressed?|ebm)\s*(\d+\.?\d*)\s*(ml|oz)/,
    /(\d+\.?\d*)\s*(ml|oz)\s*(?:pumped?|expressed?|ebm)/,
  ];
  for (const pat of pumpedPatterns) {
    const m = text.match(pat);
    if (m) {
      const qty = parseFloat(m[1]);
      const unit = m[2];
      const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';
      return { type: 'pumped', ml: unit === 'ml' ? qty : null, oz: unit === 'oz' ? qty : null, time: parsedTime, label: `🍼 Pumped ${qty}${unit}${timeLabel} logged` };
    }
  }

  // Generic bottle/fed with quantity (assume formula if not specified)
  const genericBottle = text.match(/(?:bottle|fed|gave|had)\s*(\d+\.?\d*)\s*(ml|oz)/);
  if (genericBottle) {
    const qty = parseFloat(genericBottle[1]);
    const unit = genericBottle[2];
    const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';
    return { type: 'formula', ml: unit === 'ml' ? qty : null, oz: unit === 'oz' ? qty : null, time: parsedTime, label: `🧴 Formula ${qty}${unit}${timeLabel} logged` };
  }

  return null;
}

function extractSide(text) {
  if (text.includes('left')) return 'left';
  if (text.includes('right')) return 'right';
  if (text.includes('both')) return 'both';
  return null;
}

function extractTime(text) {
  return tz.parseTimeOfDay(text);
}

function tryParseDiaper(text) {
  const parsedTime = extractTime(text);
  const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';

  if (/\b(pee\s*(and|&|\+)\s*poop|poop\s*(and|&|\+)\s*pee|both|mixed)\b/.test(text)) {
    return { type: 'both', time: parsedTime, label: `💧💩 Diaper (both)${timeLabel} logged` };
  }
  if (/\b(poop|pooped|dirty|stool|bm|bowel)\b/.test(text)) {
    return { type: 'poop', time: parsedTime, label: `💩 Diaper (poop)${timeLabel} logged` };
  }
  if (/\b(pee|peed|wet|wee|urine)\b/.test(text)) {
    return { type: 'pee', time: parsedTime, label: `💧 Diaper (pee)${timeLabel} logged` };
  }
  if (/\b(diaper|nappy)\b/.test(text) && !text.match(/\b(pee|poop|wet|dirty)\b/)) {
    return { type: 'pee', time: parsedTime, label: `💧 Diaper (pee)${timeLabel} logged` };
  }
  return null;
}

function tryParseSleep(text) {
  // "sleep/nap from Xpm to Ypm"
  const fromTo = text.match(/(?:slept?|nap|napped)\s*(?:from\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (fromTo) {
    const startH = parseHour(fromTo[1], fromTo[3]);
    const startM = parseInt(fromTo[2] || 0);
    const endH = parseHour(fromTo[4], fromTo[6]);
    const endM = parseInt(fromTo[5] || 0);

    const start = tz.parseHourToDate(fromTo[1], fromTo[2], fromTo[3]);
    let end = tz.parseHourToDate(fromTo[4], fromTo[5], fromTo[6]);

    if (end.isBefore(start) || end.isSame(start)) {
      // end is next day or start was yesterday — adjust start back
      const adjustedStart = start.subtract(1, 'day');
      const duration = end.diff(adjustedStart, 'minute');
      if (duration > 0 && duration <= 1440) {
        const h = Math.floor(duration / 60);
        const m = duration % 60;
        return { start: adjustedStart.format('YYYY-MM-DDTHH:mm:ss'), end: end.format('YYYY-MM-DDTHH:mm:ss'), duration, label: `😴 Sleep ${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}logged` };
      }
    }

    const duration = end.diff(start, 'minute');
    if (duration > 0 && duration <= 1440) {
      const h = Math.floor(duration / 60);
      const m = duration % 60;
      return { start: start.format('YYYY-MM-DDTHH:mm:ss'), end: end.format('YYYY-MM-DDTHH:mm:ss'), duration, label: `😴 Sleep ${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}logged` };
    }
  }

  // "sleep/nap Xh Ym" or "slept for 2 hours" — optionally "at Xpm"
  const durMatch = text.match(/(?:slept?|nap|napped)\s*(?:for\s*)?(?:(\d+)\s*(?:h|hours?|hrs?))?\s*(?:(\d+)\s*(?:m|min|minutes?))?/);
  if (durMatch && (durMatch[1] || durMatch[2])) {
    const hours = parseInt(durMatch[1] || 0);
    const mins = parseInt(durMatch[2] || 0);
    const totalMinutes = hours * 60 + mins;
    if (totalMinutes > 0 && totalMinutes <= 1440) {
      const parsedTime = extractTime(text);
      let endTimeStr, startTimeStr;
      if (parsedTime) {
        const endDayjs = tz.dayjs(parsedTime);
        const startDayjs = endDayjs.subtract(totalMinutes, 'minute');
        endTimeStr = endDayjs.format('YYYY-MM-DDTHH:mm:ss');
        startTimeStr = startDayjs.format('YYYY-MM-DDTHH:mm:ss');
      } else {
        endTimeStr = tz.now();
        const endDayjs = tz.dayjs(endTimeStr);
        startTimeStr = endDayjs.subtract(totalMinutes, 'minute').format('YYYY-MM-DDTHH:mm:ss');
      }
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const timeLabel = parsedTime ? ` (ended at ${tz.formatForDisplay(endTimeStr)})` : '';
      return { start: startTimeStr, end: endTimeStr, duration: totalMinutes, label: `😴 Sleep ${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${timeLabel}logged` };
    }
  }

  // Simple "sleep" or "nap" — optionally "at Xpm" to set start time
  if (/^(sleep|nap|sleeping|napping|asleep)\b/.test(text)) {
    const parsedTime = extractTime(text);
    const startTime = parsedTime || tz.now();
    const timeLabel = parsedTime ? ` at ${tz.formatForDisplay(parsedTime)}` : '';
    return { start: startTime, end: null, duration: null, label: `😴 Sleep started${timeLabel} (send "woke" or "awake" to end)` };
  }

  // "woke" or "awake" — end last in-progress sleep
  if (/^(woke|awake|wake|woken|up)\b/.test(text)) {
    const parsedTime = extractTime(text);
    if (parsedTime) return { wakeTime: parsedTime };
    return 'WAKE';
  }

  return null;
}

function parseHour(hStr, ampm) {
  let h = parseInt(hStr);
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h;
}

module.exports = { startBot };
