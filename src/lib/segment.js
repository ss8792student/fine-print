// Splits the (redacted) letter into numbered pieces [S1], [S2], ...
// Every plain-language sentence must point back to these pieces, which is what lets the
// app highlight where each claim came from and lets the checker grade it.

const ABBREVIATIONS = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'St', 'Ave', 'Blvd', 'Rd', 'Inc', 'Co', 'Corp', 'Ltd', 'Dept',
  'No', 'Nos', 'vs', 'approx', 'etc', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept',
  'Oct', 'Nov', 'Dec', 'Mon', 'Tue', 'Tues', 'Wed', 'Thu', 'Thurs', 'Fri', 'Sat', 'Sun', 'Ste', 'Apt',
  'Gov', 'Sec', 'Ch', 'Art', 'Para', 'Pg', 'Vol', 'Fig', 'Tel', 'Ext',
];
const ABBR_RE = new RegExp(`\\b(${ABBREVIATIONS.join('|')})\\.`, 'g');
const DOT = '․'; // one-dot leader: a stand-in so abbreviations don't end sentences
const MAX_LEN = 380;

function protect(text) {
  return text
    .replace(ABBR_RE, `$1${DOT}`)
    .replace(/\b([A-Za-z])\.([A-Za-z])\./g, `$1${DOT}$2${DOT}`) // U.S., a.m., p.m., e.g., i.e.
    .replace(/(\d)\.(\d)/g, `$1${DOT}$2`); // 45.00
}
const unprotect = (text) => text.split(DOT).join('.');

function splitSentences(paragraph) {
  const safe = protect(paragraph);
  const pieces = safe.split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9•\-])/);
  const out = [];
  for (const p of pieces) {
    if (p.length <= MAX_LEN) {
      out.push(p);
      continue;
    }
    // Very long legal sentences: break at semicolons, then commas, so highlights stay precise.
    let rest = p;
    while (rest.length > MAX_LEN) {
      const window = rest.slice(0, MAX_LEN);
      let cut = Math.max(window.lastIndexOf('; '), window.lastIndexOf(', '));
      if (cut < MAX_LEN * 0.4) cut = window.lastIndexOf(' ');
      if (cut <= 0) cut = MAX_LEN;
      out.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) out.push(rest);
  }
  return out.map((s) => unprotect(s).trim()).filter(Boolean);
}

export function segmentText(text) {
  const normalized = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return [];

  // Each piece remembers what followed it in the letter ("space", "line" or "para"),
  // so the Original tab can show the letter's real layout.
  const segments = [];
  const paragraphs = normalized.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const shortLines = lines.filter((l) => l.length < 45 && !/[.!?]$/.test(l)).length;
    const isBlock = lines.length > 1 && shortLines / lines.length >= 0.6;
    if (isBlock) {
      // Address blocks, headers and lists: keep each line as its own piece.
      for (const line of lines) {
        const parts = splitSentences(line);
        parts.forEach((t, i) => segments.push({ text: t, after: i === parts.length - 1 ? 'line' : 'space' }));
      }
    } else {
      // Normal prose: undo OCR line breaks (including hyphenated words), then split sentences.
      const joined = lines.join('\n').replace(/(\w)-\n(\w)/g, '$1$2').replace(/\n/g, ' ');
      for (const t of splitSentences(joined)) segments.push({ text: t, after: 'space' });
    }
    if (segments.length) segments[segments.length - 1].after = 'para';
  }
  return segments.map((s, i) => ({ id: `S${i + 1}`, text: s.text, after: s.after }));
}
