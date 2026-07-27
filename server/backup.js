#!/usr/bin/env node
/**
 * Daily DB backup - sends SQLite file to Telegram
 * Run via cron: 0 23 * * * /usr/bin/node /home/ec2-user/baby-tracker/server/backup.js
 */

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8818617776:AAH1ToNqkXSaq2gY-msGbd44zyYogRswO94';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '6787072356';
const DB_PATH = path.join(__dirname, '../data/baby-tracker.db');

async function backup() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('No DB file found. Skipping backup.');
    process.exit(0);
  }

  const bot = new TelegramBot(TOKEN);
  const date = new Date().toISOString().slice(0, 10);
  const stats = fs.statSync(DB_PATH);
  const sizeKB = Math.round(stats.size / 1024);

  try {
    await bot.sendDocument(ADMIN_CHAT_ID, DB_PATH, {
      caption: `📦 Daily DB Backup\nDate: ${date}\nSize: ${sizeKB} KB`,
    }, {
      filename: `baby-tracker-backup-${date}.db`,
      contentType: 'application/octet-stream',
    });
    console.log(`Backup sent to Telegram (${sizeKB} KB)`);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

backup();
