// Saved letters live only in this browser on this device (localStorage). Nothing is uploaded.
const KEY = 'fineprint-saved-v1';
const MAX = 20;

export function listSaved() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}

export function saveLetter(entry) {
  const id = entry.id || `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const full = { ...entry, id, savedAt: new Date().toISOString() };
  const list = [full, ...listSaved().filter((e) => e.id !== id)];
  return write(list) ? full : null;
}

export function deleteSaved(id) {
  write(listSaved().filter((e) => e.id !== id));
  return listSaved();
}

// Every saved deadline, soonest first: [{ letterId, title, label, date (ISO), daysLeft }]
export function upcomingDeadlines(list, today) {
  const day = (iso) => new Date(`${iso}T00:00:00Z`);
  return list
    .flatMap((e) => (e.deadlines || []).map((d) => ({ letterId: e.id, title: e.title, sender: e.sender, label: d.label, date: d.date })))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ ...d, daysLeft: Math.round((day(d.date) - today) / 86400000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
