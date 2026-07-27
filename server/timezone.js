const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York';

/**
 * Get current time as ISO string in app timezone
 */
function now() {
  return dayjs().tz(APP_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');
}

/**
 * Get today's date in app timezone (YYYY-MM-DD)
 */
function today() {
  return dayjs().tz(APP_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Parse "at 4pm", "at 2:30pm" into ISO string in app timezone
 */
function parseTimeOfDay(text) {
  const match = text.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || 0);
  const ampm = (match[3] || '').toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  // Build time in app timezone for today
  const todayStr = dayjs().tz(APP_TIMEZONE).format('YYYY-MM-DD');
  const target = dayjs.tz(`${todayStr} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, 'YYYY-MM-DD HH:mm', APP_TIMEZONE);

  // If time is in future, assume yesterday
  if (target.isAfter(dayjs().tz(APP_TIMEZONE))) {
    return target.subtract(1, 'day').format('YYYY-MM-DDTHH:mm:ss');
  }

  return target.format('YYYY-MM-DDTHH:mm:ss');
}

/**
 * Parse hour with am/pm for "from X to Y" patterns
 */
function parseHourToDate(hourStr, minuteStr, ampm) {
  let h = parseInt(hourStr);
  const m = parseInt(minuteStr || 0);
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;

  const todayStr = dayjs().tz(APP_TIMEZONE).format('YYYY-MM-DD');
  return dayjs.tz(`${todayStr} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, 'YYYY-MM-DD HH:mm', APP_TIMEZONE);
}

/**
 * Format ISO/local time string for display in app timezone
 */
function formatForDisplay(isoString) {
  return dayjs(isoString).tz(APP_TIMEZONE).format('h:mm A');
}

module.exports = { now, today, parseTimeOfDay, parseHourToDate, formatForDisplay, APP_TIMEZONE, dayjs };
