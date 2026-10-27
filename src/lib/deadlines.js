// Deadline math is done here, in code — never by the AI.
// Dates are handled as UTC calendar days so time zones can't shift them.

export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.getUTCMonth() !== Number(m[2]) - 1) return null; // e.g. 2026-02-31
  return date;
}

export const toISO = (date) => date.toISOString().slice(0, 10);

export function todayUTC(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// ---- US federal holidays (observed dates), used for business-day counting ----
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}
function lastWeekday(year, month, weekday) {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month, last.getUTCDate() - offset));
}
function observed(date) {
  const day = date.getUTCDay();
  if (day === 6) return addDays(date, -1);
  if (day === 0) return addDays(date, 1);
  return date;
}

const holidayCache = new Map();
export function federalHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const list = [
    ["New Year's Day", observed(new Date(Date.UTC(year, 0, 1)))],
    ['Martin Luther King Jr. Day', nthWeekday(year, 0, 1, 3)],
    ["Washington's Birthday", nthWeekday(year, 1, 1, 3)],
    ['Memorial Day', lastWeekday(year, 4, 1)],
    ['Juneteenth', observed(new Date(Date.UTC(year, 5, 19)))],
    ['Independence Day', observed(new Date(Date.UTC(year, 6, 4)))],
    ['Labor Day', nthWeekday(year, 8, 1, 1)],
    ['Columbus Day', nthWeekday(year, 9, 1, 2)],
    ['Veterans Day', observed(new Date(Date.UTC(year, 10, 11)))],
    ['Thanksgiving Day', nthWeekday(year, 10, 4, 4)],
    ['Christmas Day', observed(new Date(Date.UTC(year, 11, 25)))],
  ];
  const map = new Map(list.map(([name, d]) => [toISO(d), name]));
  holidayCache.set(year, map);
  return map;
}
const holidayName = (d) => federalHolidays(d.getUTCFullYear()).get(toISO(d)) || null;

function addBusinessDays(date, n) {
  let d = new Date(date);
  let left = n;
  const skipped = [];
  while (left > 0) {
    d = addDays(d, 1);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    const holiday = holidayName(d);
    if (holiday) {
      skipped.push(holiday);
      continue;
    }
    left--;
  }
  return { date: d, skipped };
}

function addMonths(date, n) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

export function addPeriod(date, amount, unit) {
  switch (unit) {
    case 'days':
      return addDays(date, amount);
    case 'business_days':
      return addBusinessDays(date, amount).date;
    case 'weeks':
      return addDays(date, amount * 7);
    case 'months':
      return addMonths(date, amount);
    case 'years':
      return addMonths(date, amount * 12);
    default:
      return null;
  }
}

export function formatDate(date, locale = 'en-US', opts = {}) {
  if (!date) return '';
  try {
    return date.toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', ...opts });
  } catch {
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', ...opts });
  }
}

// Returns { status, date, steps, daysLeft }.
// status: 'ok' | 'needs_receipt' | 'needs_letter_date' | 'unclear'
// steps are structured ({k: ...}) so the screen can show them in the reader's language.
export function computeDeadline(dl, { letterDate, receiptDate, today = todayUTC() }) {
  const result = { status: 'unclear', date: null, steps: [], daysLeft: null };

  if (dl.kind === 'absolute') {
    const date = parseISO(dl.date);
    if (!date) return { ...result, steps: [{ k: 'unreadable' }] };
    Object.assign(result, { status: 'ok', date, steps: [{ k: 'direct' }] });
  } else if (dl.kind === 'relative') {
    if (!dl.amount || dl.unit === 'none') return { ...result, steps: [{ k: 'unclear', text: dl.anchor_text }] };
    let start = null;
    if (dl.anchor === 'letter_date') {
      start = letterDate;
      if (!start) return { ...result, status: 'needs_letter_date' };
    } else if (dl.anchor === 'receipt_date') {
      start = receiptDate;
      if (!start) return { ...result, status: 'needs_receipt' };
    } else {
      return { ...result, steps: [{ k: 'unclear', text: dl.anchor_text, amount: dl.amount, unit: dl.unit }] };
    }
    let date;
    let skipped = [];
    if (dl.unit === 'business_days') ({ date, skipped } = addBusinessDays(start, dl.amount));
    else date = addPeriod(start, dl.amount, dl.unit);
    result.status = 'ok';
    result.date = date;
    result.steps = [
      { k: 'start', date: start, anchor: dl.anchor },
      { k: 'add', amount: dl.amount, unit: dl.unit, skipped },
      { k: 'result', date },
    ];
  }

  if (result.date) result.daysLeft = Math.round((result.date - today) / 86400000);
  return result;
}
