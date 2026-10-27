// Glue between the on-device steps, the two AI calls and the rule-based checks.
import { redact } from './redact.js';
import { segmentText } from './segment.js';
import { missingNumbers, dateAppearsIn, numbersIn, sourceNumbers, combineVerdict } from './checks.js';
import { parseISO } from './deadlines.js';

export function prepare(rawText, options = {}) {
  const { text, items } = redact(rawText, options);
  return { redacted: text, items, segments: segmentText(text) };
}

const arr = (v) => (Array.isArray(v) ? v : []);

// Keep only source ids that really exist, so a made-up citation can't sneak through.
export function sanitizeResult(result, segments) {
  const valid = new Set(segments.map((s) => s.id));
  const ids = (list) => [...new Set(arr(list).map(String).filter((id) => valid.has(id)))];
  return {
    is_document: result?.is_document !== false,
    document_type: String(result?.document_type || ''),
    sender: String(result?.sender || ''),
    letter_date: String(result?.letter_date || ''),
    letter_date_source: valid.has(result?.letter_date_source) ? result.letter_date_source : '',
    gist: String(result?.gist || ''),
    urgency: ['low', 'medium', 'high'].includes(String(result?.urgency).toLowerCase()) ? String(result.urgency).toLowerCase() : 'medium',
    urgency_reason: String(result?.urgency_reason || ''),
    plain_sentences: arr(result?.plain_sentences)
      .filter((p) => p?.text)
      .map((p, i) => ({ id: `p${i + 1}`, text: String(p.text), source_ids: ids(p.source_ids) })),
    actions: arr(result?.actions)
      .filter((a) => a?.task)
      .map((a, i) => ({ id: `a${i + 1}`, text: String(a.task), source_ids: ids(a.source_ids) })),
    deadlines: arr(result?.deadlines)
      .filter((d) => d?.label)
      .map((d, i) => ({
        id: `d${i + 1}`,
        label: String(d.label),
        kind: d.kind === 'absolute' ? 'absolute' : 'relative',
        date: String(d.date || ''),
        amount: Number.isFinite(Number(d.amount)) ? Number(d.amount) : 0,
        unit: String(d.unit || 'none').toLowerCase(),
        anchor: String(d.anchor || 'none').toLowerCase(),
        anchor_text: String(d.anchor_text || ''),
        source_ids: ids(d.source_ids),
      })),
    glossary: arr(result?.glossary).filter((g) => g?.term && g?.meaning),
    questions_to_ask: arr(result?.questions_to_ask).filter(Boolean).map(String),
  };
}

// The AI sometimes cites the passage about *what* to do but not the one with the amount
// ("Pay $186.42 before Nov 12" citing only the Nov 12 sentence). For each number a claim
// mentions that its cited passages lack, find the passage of the letter that does contain it
// and add that to the claim's sources. A number that appears nowhere in the letter is still
// flagged.
export function addMissingSources(result, segments) {
  const segById = new Map(segments.map((s) => [s.id, s]));
  const numbersBySeg = segments.map((s) => ({ id: s.id, nums: sourceNumbers(s.text) }));
  const fix = (c) => {
    if (!c.source_ids.length) return c;
    const missing = missingNumbers(c.text, sourcesText(c.source_ids, segById));
    if (!missing.length) return c;
    const ids = [...c.source_ids];
    for (const n of missing) {
      const hit = numbersBySeg.find((s) => s.nums.has(n));
      if (hit && !ids.includes(hit.id)) ids.push(hit.id);
    }
    return { ...c, source_ids: ids };
  };
  return { ...result, plain_sentences: result.plain_sentences.map(fix), actions: result.actions.map(fix) };
}

export function sourcesText(sourceIds, segById) {
  return sourceIds.map((id) => segById.get(id)?.text || '').join(' ');
}

// What the independent checker receives: each claim plus only the pieces it cites.
export function buildClaims(result, segById) {
  return [...result.plain_sentences, ...result.actions].map((c) => ({
    id: c.id,
    text: c.text,
    sources: c.source_ids.map((id) => ({ id, text: segById.get(id)?.text || '' })),
  }));
}

export function localChecks(result, segById) {
  const out = {};
  for (const c of [...result.plain_sentences, ...result.actions]) {
    out[c.id] = {
      hasSources: c.source_ids.length > 0,
      missing: c.source_ids.length ? missingNumbers(c.text, sourcesText(c.source_ids, segById)) : [],
    };
  }
  return out;
}

export function finalBadges(result, local, verdicts) {
  const byId = new Map(arr(verdicts).map((v) => [v.id, { ...v, verdict: String(v.verdict).toLowerCase() }]));
  const badges = {};
  for (const id of Object.keys(local)) {
    const v = byId.get(id);
    if (!verdicts) badges[id] = { level: 'pending', reason: '', missing: [] };
    else if (v) badges[id] = combineVerdict(v, local[id]);
    else {
      const b = combineVerdict({ verdict: 'none' }, local[id]);
      badges[id] = b.level === 'pending' ? { ...b, level: 'warn', noResult: true } : b;
    }
  }
  return badges;
}

// The letter date from the AI is only trusted if that date really appears in the letter.
export function groundedLetterDate(result, segments, segById) {
  const date = parseISO(result.letter_date);
  if (!date) return { date: null, grounded: false };
  const src = result.letter_date_source ? segById.get(result.letter_date_source)?.text : segments.map((s) => s.text).join(' ');
  return { date, grounded: dateAppearsIn(result.letter_date, src) };
}

// Returns { ok, key, vars } — key is a label in i18n.js.
export function deadlineGrounding(dl, segById) {
  const src = sourcesText(dl.source_ids, segById);
  if (!dl.source_ids.length) return { ok: false, key: 'ground_none' };
  if (dl.kind === 'absolute') {
    return dateAppearsIn(dl.date, src) ? { ok: true, key: 'ground_date_ok' } : { ok: false, key: 'ground_date_bad' };
  }
  return numbersIn(src, { includeWords: true }).has(String(dl.amount))
    ? { ok: true, key: 'ground_amount_ok', vars: { n: dl.amount } }
    : { ok: false, key: 'ground_amount_bad' };
}
