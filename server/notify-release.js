#!/usr/bin/env node
/**
 * Send release notes to all linked Telegram users
 * Usage: node server/notify-release.js "Your release message here"
 * Or via GitHub Actions after deploy
 */

const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8818617776:AAH1ToNqkXSaq2gY-msGbd44zyYogRswO94';

async function notifyUsers(message) {
  const bot = new TelegramBot(TOKEN);

  // Get all linked Telegram users
  let links;
  try {
    links = db.prepare('SELECT DISTINCT chat_id FROM telegram_links').all();
  } catch {
    console.log('No telegram_links table or no users.');
    process.exit(0);
  }

  if (!links.length) {
    console.log('No linked users to notify.');
    process.exit(0);
  }

  const header = '🚀 *Baby Tracker Update*\n\n';
  const fullMessage = header + message;

  let sent = 0;
  let failed = 0;

  for (const link of links) {
    try {
      await bot.sendMessage(link.chat_id, fullMessage, { parse_mode: 'Markdown' });
      sent++;
    } catch (err) {
      console.error(`Failed to notify ${link.chat_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Release notification sent: ${sent} users, ${failed} failed`);
  process.exit(0);
}

// Get message from command line args or stdin
const args = process.argv.slice(2);
if (args.length > 0) {
  notifyUsers(args.join(' '));
} else {
  // Read from stdin (piped from GitHub Actions)
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => input += chunk);
  process.stdin.on('end', () => {
    if (input.trim()) notifyUsers(input.trim());
    else { console.log('No message provided.'); process.exit(1); }
  });
}
