// Calendar export for deadlines: a standard .ics file (opens in Apple/Outlook/Google
// Calendar) and a Google Calendar link. Only the deadline label is included — never
// private details.
import { addPeriod, toISO } from './deadlines.js';

const compact = (date) => toISO(date).replace(/-/g, '');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

function vevent({ title, date, details }) {
  const end = addPeriod(date, 1, 'days');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `${compact(date)}-${Math.random().toString(36).slice(2)}@fineprint`;
  const alarm = (trigger) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`,
    // Reminders 3 days and 1 day before (at 9 AM on all-day events in most calendars).
    ...alarm('-P2DT15H'),
    ...alarm('-PT15H'),
    'END:VEVENT',
  ];
}

// One or many deadlines in a single calendar file.
export function buildICS(events) {
  const list = Array.isArray(events) ? events : [events];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fine Print//Deadline//EN', 'CALSCALE:GREGORIAN', ...list.flatMap(vevent), 'END:VCALENDAR'].join('\r\n');
}

export function downloadICS(events, filename) {
  const list = Array.isArray(events) ? events : [events];
  const blob = new Blob([buildICS(list)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${list[0].title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'deadline'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl({ title, date, details }) {
  const end = addPeriod(date, 1, 'days');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${compact(date)}/${compact(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
