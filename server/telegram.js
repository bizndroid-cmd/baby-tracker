const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8818617776:AAH1ToNqkXSaq2gY-msGbd44zyYogRswO94';

let bot;

function startBot() {
  bot = new TelegramBot(TOKEN, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (!text) return;

    // Handle /start
    if (text === '/start') {
      return bot.sendMessage(chatId, 
        `🍼 Baby Tracker Bot\n\nLink your account first:\n/link your@email.com\n\nThen log entries:\n• bf 15 left — breastfeed\n• formula 120ml — formula\n• pumped 4oz — pumped milk\n• pee / poop / both — diaper\n• sleep 2h — sleep session\n• /help — show commands`
      );
    }

    // Handle /help
    if (text === '/help') {
      return bot.sendMessage(chatId,
        `📋 Commands:\n\n🤱 Feeding:\n• bf [min] [left/right/both]\n• formula [amount]ml or [amount]oz\n• pumped [amount]ml or [amount]oz\n\n🧷 Diaper:\n• pee\n• poop\n• both\n\n😴 Sleep:\n• sleep [duration]h or [duration]m\n• sleep [hours]h [min]m\n\n⚙️ Account:\n• /link email@example.com\n• /status — check link\n• /baby — show active baby`
      );
    }

    // Handle /link
    if (text.startsWith('/link')) {
      const email = text.replace('/link', '').trim();
      if (!email || !email.includes('@')) {
        return bot.sendMessage(chatId, '❌ Usage: /link your@email.com');
      }

      const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
      if (!user) {
        return bot.sendMessage(chatId, '❌ No account found with that email. Register in the web app first.');
      }

      // Store telegram chat_id linked to user
      db.exec(`CREATE TABLE IF NOT EXISTS telegram_links (
        chat_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      const existing = db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(String(chatId));
      if (existing) {
        db.prepare('UPDATE telegram_links SET user_id = ? WHERE chat_id = ?').run(user.id, String(chatId));
      } else {
        db.prepare('INSERT INTO telegram_links (chat_id, user_id) VALUES (?, ?)').run(String(chatId), user.id);
      }

      return bot.sendMessage(chatId, `✅ Linked to account: ${user.name} (${email})\n\nNow send messages to log entries!`);
    }

    // Handle /status
    if (text === '/status') {
      const link = getLink(chatId);
      if (!link) return bot.sendMessage(chatId, '❌ Not linked. Use /link your@email.com');
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(link.user_id);
      return bot.sendMessage(chatId, `✅ Linked to: ${user.name} (${user.email})`);
    }

    // Handle /baby
    if (text === '/baby') {
      const link = getLink(chatId);
      if (!link) return bot.sendMessage(chatId, '❌ Not linked. Use /link your@email.com');
      const baby = getActiveBaby(link.user_id);
      if (!baby) return bot.sendMessage(chatId, '❌ No baby profiles. Add one in the web app.');
      return bot.sendMessage(chatId, `👶 Active baby: ${baby.name}`);
    }

    // All other messages — parse as entry
    const link = getLink(chatId);
    if (!link) {
      return bot.sendMessage(chatId, '❌ Link your account first: /link your@email.com');
    }

    const baby = getActiveBaby(link.user_id);
    if (!baby) {
      return bot.sendMessage(chatId, '❌ No baby profiles found. Add one in the web app first.');
    }

    const result = parseAndSave(text, link.user_id, baby.id);
    if (result) {
      bot.sendMessage(chatId, `✅ ${result}`);
    } else {
      bot.sendMessage(chatId, `❓ Couldn't understand: "${text}"\n\nTry: bf 15 left, formula 120ml, poop, sleep 2h\nSend /help for all commands.`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  console.log('Telegram bot started');
}

function getLink(chatId) {
  try {
    return db.prepare('SELECT * FROM telegram_links WHERE chat_id = ?').get(String(chatId));
  } catch {
    return null;
  }
}

function getActiveBaby(userId) {
  // Get most recently created baby for user
  return db.prepare('SELECT * FROM babies WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
}

function parseAndSave(text, userId, babyId) {
  const lower = text.toLowerCase().trim();

  // Breastfeed: "bf 15 left" or "breast 20 right" or "bf 10"
  const bfMatch = lower.match(/^(bf|breast|breastfeed)\s+(\d+)\s*(min|m)?\s*(left|right|both)?/);
  if (bfMatch) {
    const minutes = parseInt(bfMatch[2]);
    const side = bfMatch[4] || null;
    const id = uuidv4();
    db.prepare('INSERT INTO feedings (id, baby_id, user_id, type, duration_minutes, side, fed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, babyId, userId, 'breast', minutes, side, new Date().toISOString()
    );
    return `Breastfeed ${minutes} min${side ? ' (' + side + ')' : ''} logged`;
  }

  // Formula: "formula 120ml" or "formula 4oz"
  const formulaMatch = lower.match(/^formula\s+(\d+\.?\d*)\s*(ml|oz)/);
  if (formulaMatch) {
    const qty = parseFloat(formulaMatch[1]);
    const unit = formulaMatch[2];
    const id = uuidv4();
    const ml = unit === 'ml' ? qty : null;
    const oz = unit === 'oz' ? qty : null;
    db.prepare('INSERT INTO feedings (id, baby_id, user_id, type, quantity_ml, quantity_oz, fed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, babyId, userId, 'formula', ml, oz, new Date().toISOString()
    );
    return `Formula ${qty}${unit} logged`;
  }

  // Pumped: "pumped 120ml" or "pumped 4oz"
  const pumpedMatch = lower.match(/^pumped?\s+(\d+\.?\d*)\s*(ml|oz)/);
  if (pumpedMatch) {
    const qty = parseFloat(pumpedMatch[1]);
    const unit = pumpedMatch[2];
    const id = uuidv4();
    const ml = unit === 'ml' ? qty : null;
    const oz = unit === 'oz' ? qty : null;
    db.prepare('INSERT INTO feedings (id, baby_id, user_id, type, quantity_ml, quantity_oz, fed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, babyId, userId, 'pumped', ml, oz, new Date().toISOString()
    );
    return `Pumped ${qty}${unit} logged`;
  }

  // Diaper: "pee", "poop", "both", "diaper pee"
  const diaperMatch = lower.match(/^(pee|poop|both|wet|dirty)/);
  if (diaperMatch) {
    let type = diaperMatch[1];
    if (type === 'wet') type = 'pee';
    if (type === 'dirty') type = 'poop';
    if (lower.includes('poop') && lower.includes('pee')) type = 'both';
    const id = uuidv4();
    db.prepare('INSERT INTO diapers (id, baby_id, user_id, type, changed_at) VALUES (?, ?, ?, ?, ?)').run(
      id, babyId, userId, type, new Date().toISOString()
    );
    const emoji = type === 'pee' ? '💧' : type === 'poop' ? '💩' : '💧💩';
    return `${emoji} Diaper (${type}) logged`;
  }

  // Sleep: "sleep 2h", "sleep 90m", "sleep 1h 30m", "nap 45m"
  const sleepMatch = lower.match(/^(sleep|nap)\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);
  if (sleepMatch && (sleepMatch[2] || sleepMatch[3])) {
    const hours = parseInt(sleepMatch[2] || 0);
    const mins = parseInt(sleepMatch[3] || 0);
    const totalMinutes = hours * 60 + mins;
    if (totalMinutes > 0 && totalMinutes <= 1440) {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - totalMinutes * 60000);
      const id = uuidv4();
      db.prepare('INSERT INTO sleep (id, baby_id, user_id, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)').run(
        id, babyId, userId, startTime.toISOString(), endTime.toISOString(), totalMinutes
      );
      return `😴 Sleep ${hours > 0 ? hours + 'h ' : ''}${mins > 0 ? mins + 'm' : ''} logged`;
    }
  }

  return null;
}

module.exports = { startBot };
