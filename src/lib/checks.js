// Rule-based checks that do NOT rely on an AI. They catch the mistakes AI judges miss most:
// a changed number, amount or date.

const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const stripTokens = (t) => String(t || '').replace(/\[[A-Z]+_\d+\]/g, ' ');

function canonical(numStr) {
  const n = Number(numStr.replace(/,/g, ''));
  return Number.isFinite(n) ? String(n) : numStr;
}

// All numbers mentioned in a text, as canonical strings ("1,250.00" -> "1250").
export function numbersIn(text, { includeWords = false } = {}) {
  const t = stripTokens(text);
  const out = new Set();
  for (const m of t.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) out.add(canonical(m[0]));
  if (includeWords) {
    const words = t.toLowerCase().match(/[a-z]+/g) || [];
    words.forEach((w, i) => {
      const a = WORD_NUMBERS[w];
      if (a === undefined || w === 'hundred') return;
      out.add(String(a));
      const b = WORD_NUMBERS[words[i + 1]];
      if (a >= 20 && a % 10 === 0 && b !== undefined && b > 0 && b < 10) out.add(String(a + b)); // forty-five
    });
  }
  return out;
}

// Every number a source mentions, including written-out numbers and the parts of dates
// (so "Nov 15, 2026" also counts as 11, 15 and 2026).
export function sourceNumbers(sourceText) {
  const inSource = numbersIn(sourceText, { includeWords: true });
  for (const d of datesIn(sourceText)) {
    inSource.add(String(d.m));
    inSource.add(String(d.d));
    inSource.add(String(d.y));
    inSource.add(String(d.y % 100));
  }
  return inSource;
}

// Numbers in the claim that never appear in its cited sources.
export function missingNumbers(claim, sourceText) {
  const inSource = sourceNumbers(sourceText);
  return [...numbersIn(claim)].filter((n) => !inSource.has(n));
}

// Finds calendar dates written in common US formats. Returns [{y,m,d}].
export function datesIn(text) {
  const t = String(text || '');
  const found = [];
  const push = (y, m, d) => {
    y = Number(y);
    if (y < 100) y += 2000;
    m = Number(m);
    d = Number(d);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200) found.push({ y, m, d });
  };
  for (const x of t.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) push(x[1], x[2], x[3]);
  for (const x of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) push(x[3], x[1], x[2]);
  for (const x of t.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g)) {
    const m = MONTHS[x[1].toLowerCase()];
    if (m) push(x[3], m, x[2]);
  }
  for (const x of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) {
    const m = MONTHS[x[2].toLowerCase()];
    if (m) push(x[3], m, x[1]);
  }
  return found;
}

// Does an ISO date (YYYY-MM-DD) from the AI actually appear in the source text?
export function dateAppearsIn(iso, sourceText) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return datesIn(sourceText).some((x) => x.y === y && x.m === mo && x.d === d);
}

// Combine the AI checker's verdict with the rule-based number check into one badge.
// Returns { level, reason, missing, noSource } — the screen turns it into words.
export function combineVerdict({ verdict, reason = '' }, { hasSources, missing }) {
  const base = { reason: reason || '', missing: missing || [], noSource: !hasSources };
  if (!hasSources) return { ...base, level: 'warn' };
  if (missing.length) return { ...base, level: verdict === 'unsupported' ? 'bad' : 'warn' };
  if (verdict === 'supported') return { ...base, level: 'ok' };
  if (verdict === 'partial') return { ...base, level: 'warn' };
  if (verdict === 'unsupported') return { ...base, level: 'bad' };
  return { ...base, level: 'pending' };
}
