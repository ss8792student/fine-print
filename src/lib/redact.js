// Hides private details on the device BEFORE anything is sent to the AI.
// Each hidden value becomes a placeholder like [ACCOUNT_1]; the real value stays in the
// browser and is put back only when results are shown on screen.
//
// Options:
//   extra: strings the person selected and asked to hide ("Hide selected text")
//   allow: values the person chose to send after all (un-hidden)

const LABELLED_ID =
  /\b((?:account|acct|case|claim|policy|member|customer|student|patient|reference|ref|invoice|loan|file|docket|citation|id)\.?\s*(?:no\.?|number|num\.?|#|id)?\s*[:#]?\s*)([A-Z]{0,4}[-]?\d[A-Z0-9-]{4,})/gi;
const DOB = /\b((?:date of birth|birth\s?date|d\.?o\.?b\.?)\s*[:#]?\s*)(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|[A-Z][a-z]+\.? \d{1,2},? \d{4})/gi;
const SSN_LABELLED = /\b((?:ssn|social security(?: number| no\.?| #)?)\s*[:#]?\s*)(\d{3}[- ]?\d{2}[- ]?\d{4})\b/gi;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;
const LONG_NUMBER = /\b\d[\d-]{6,}\d\b/g;

const STREET_WORDS =
  'Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Circle|Cir|Place|Pl|Parkway|Pkwy|Trail|Trl|Terrace|Ter|Highway|Hwy|Loop|Path|Pike|Square|Sq|Cove|Cv|Row|Crossing|Xing|Point|Pt|Ridge|Run';
const STREET = new RegExp(
  `\\b\\d{1,6}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][A-Za-z'’.-]*\\s+){0,4}(?:${STREET_WORDS})\\b\\.?(?:,?\\s+(?:Apt|Apartment|Unit|Suite|Ste|Bldg|#)\\.?\\s*#?[A-Za-z0-9-]+)?`,
  'g',
);
const PO_BOX = /\bP\.?\s?O\.?\s+Box\s+\d+/gi;
const CITY_LINE = /^[A-Z][A-Za-z .'’-]+,\s*[A-Z]{2}\.?\s+\d{5}(?:-\d{4})?$/;

const NAME_LABELS =
  /^(.*?\b(?:to the parent or guardian of|parent\/guardian of|parent or guardian of|parent\/guardian|member|patient|student|student name|resident\(s\)|residents?|tenant\(s\)|tenants?|name|recipient|attn\.?|attention|insured|employee|claimant|beneficiary|applicant|account holder|debtor|defendant|plaintiff|policyholder|subscriber|guarantor|borrower|child|guardian|parent)\s*:\s*)(.+?)\s*$/i;
const NAME_VALUE = /^(?:(?:Mr|Mrs|Ms|Mx|Dr|Miss)\.?\s+)?[A-Z][A-Za-z'’.-]+(?:\s+(?:and|&|[A-Z][A-Za-z'’.-]*)){1,6}$/;
const ORG_WORDS =
  /\b(?:Inc|LLC|Ltd|Co|Corp|Company|Department|Dept|Division|Office|Apartments?|Plan|District|Services?|Center|Centre|Bank|County|City|School|Schools|Authority|Agency|Utilities|Utility|Management|Health|Hospital|Clinic|University|College|Court|Mutual|Insurance|Association|Board|Group|Water|Power|Energy|Electric|Campus|Grade|Notice|Program|Appeals|Grievances|Accounts|Sample|Final|Real|Not|Dear)\b/i;
const GENERIC_SALUTATIONS =
  /^(?:customer|valued customer|parent|parents|guardian|parent\/guardian|parent or guardian|member|resident|residents|resident\(s\)|tenant|tenants|sir|madam|sir or madam|patient|applicant|friend|neighbor|neighbour|policyholder|student|family|families|homeowner|taxpayer|voter|juror|colleague|team|all|client|account holder|borrower|participant|beneficiary)$/i;

const NOT_PRIVATE = [
  /^\d{4}-\d{2}-\d{2}$/, // 2026-10-20
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // 10-20-2026
  /^\d{5}-\d{4}$/, // ZIP+4
];

export const TOKEN_RE = /\[(SSN|CARD|ACCOUNT|PHONE|EMAIL|DOB|NAME|ADDRESS|PRIVATE)_(\d+)\]/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function luhnOk(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

const isName = (v) => {
  const t = v.trim().replace(/[,;]$/, '');
  return NAME_VALUE.test(t) && !ORG_WORDS.test(t) && !/\d/.test(t) && t.length <= 60;
};

// Finds the people a letter is addressed to.
export function findNames(text) {
  const names = new Set();
  const lines = text.split('\n').map((l) => l.trim());

  lines.forEach((line, i) => {
    // Labelled: "Member: Priya Natarajan", "To the Parent or Guardian of: Ava Thompson"
    const m = NAME_LABELS.exec(line);
    if (m && isName(m[2])) names.add(m[2].trim().replace(/[,;]$/, ''));

    // Recipient block: a name line directly above a street address line.
    const next = lines.slice(i + 1).find((l) => l);
    if (next && /^\d{1,6}\s/.test(next) && new RegExp(STREET.source).test(next) && isName(line) && line.split(/\s+/).length <= 5) {
      names.add(line);
    }
  });

  // Salutation: "Dear Maria Gonzalez," / "Dear Ms. Gonzalez:"
  for (const m of text.matchAll(/\bDear\s+((?:(?:Mr|Mrs|Ms|Mx|Dr|Miss)\.?\s+)?[A-Z][A-Za-z'’-]+(?:\s+(?:and|&|[A-Z][A-Za-z'’-]+)){0,4})\s*[,:]/g)) {
    const who = m[1].trim();
    const bare = who.replace(/^(?:Mr|Mrs|Ms|Mx|Dr|Miss)\.?\s+/, '');
    if (GENERIC_SALUTATIONS.test(bare) || ORG_WORDS.test(bare)) continue;
    names.add(bare);
  }
  return [...names].sort((a, b) => b.length - a.length);
}

export function redact(input, { extra = [], allow = [] } = {}) {
  const items = [];
  const byValue = new Map();
  const counters = {};
  const allowed = new Set(allow);

  const tokenFor = (type, value) => {
    if (allowed.has(value)) return value;
    const key = `${type}:${value}`;
    if (byValue.has(key)) return byValue.get(key).token;
    counters[type] = (counters[type] || 0) + 1;
    const token = `[${type}_${counters[type]}]`;
    const item = { token, type, value };
    byValue.set(key, item);
    items.push(item);
    return token;
  };

  let text = String(input || '');

  // 1. Anything the person chose to hide themselves.
  for (const value of [...new Set(extra.map((e) => e.trim()).filter((e) => e.length >= 2))].sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(escapeRe(value), 'g'), () => tokenFor('PRIVATE', value));
  }

  // 2. Numbers and contact details.
  text = text.replace(SSN_LABELLED, (_, label, value) => label + tokenFor('SSN', value));
  text = text.replace(SSN, (m) => tokenFor('SSN', m));
  text = text.replace(DOB, (_, label, value) => label + tokenFor('DOB', value));
  text = text.replace(EMAIL, (m) => tokenFor('EMAIL', m));
  text = text.replace(CARD, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || !luhnOk(digits)) return m;
    const trailing = m.match(/[ -]$/) ? m.slice(-1) : '';
    return tokenFor('CARD', m.trim().replace(/[ -]$/, '')) + trailing;
  });
  text = text.replace(PHONE, (m) => tokenFor('PHONE', m.trim()));
  text = text.replace(LABELLED_ID, (whole, label, value) => {
    if (NOT_PRIVATE.some((re) => re.test(value))) return whole;
    if ((value.match(/\d/g) || []).length < 4) return whole;
    return label + tokenFor('ACCOUNT', value);
  });
  text = text.replace(LONG_NUMBER, (m) => {
    if (NOT_PRIVATE.some((re) => re.test(m))) return m;
    if ((m.match(/\d/g) || []).length < 8) return m;
    return tokenFor('ACCOUNT', m);
  });

  // 3. Names (found before addresses are replaced, since the recipient block needs them).
  const names = findNames(text);

  // 4. Street addresses and the "City, ST 12345" line right after them.
  text = text.replace(PO_BOX, (m) => tokenFor('ADDRESS', m));
  text = text.replace(STREET, (m) => tokenFor('ADDRESS', m.trim()));
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const prev = lines.slice(0, i).reverse().find((l) => l.trim());
    if (prev && /\[ADDRESS_\d+\]\s*$/.test(prev) && CITY_LINE.test(lines[i].trim())) {
      const city = lines[i].trim();
      lines[i] = lines[i].replace(city, tokenFor('ADDRESS', city));
    }
  }
  text = lines.join('\n');

  // 5. Replace every mention of each name, including "Ms. Lastname".
  for (const name of names) {
    text = text.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'g'), () => tokenFor('NAME', name));
    const parts = name.split(/\s+/);
    const last = parts[parts.length - 1];
    if (parts.length >= 2 && last.length > 2 && !/^(?:and|&)$/i.test(last)) {
      text = text.replace(new RegExp(`\\b((?:Mr|Mrs|Ms|Mx|Dr|Miss)\\.?\\s+)${escapeRe(last)}\\b`, 'g'), (_, title) => title + tokenFor('NAME', name));
    }
  }

  return { text, items };
}

const LABELS = {
  SSN: 'Social Security number',
  CARD: 'Card number',
  ACCOUNT: 'Account or case number',
  PHONE: 'Phone number',
  EMAIL: 'Email address',
  DOB: 'Date of birth',
  NAME: 'Name',
  ADDRESS: 'Address',
  PRIVATE: 'Hidden by you',
};
export const labelFor = (type) => LABELS[type] || 'Private detail';

// How a hidden value is shown back to the person on their own screen.
export function displayValue(item) {
  if (!item) return '';
  const v = item.value;
  const last4 = v.replace(/[^0-9A-Z]/gi, '').slice(-4);
  if (item.type === 'SSN') return `•••-••-${last4}`;
  if (item.type === 'CARD') return `•••• ${last4}`;
  if (item.type === 'ACCOUNT' && v.length > 6) return `•••${last4}`;
  return v;
}

// Splits text into plain strings and {token, item} parts for rendering.
export function splitTokens(text, items) {
  const lookup = new Map(items.map((i) => [i.token, i]));
  const parts = [];
  let last = 0;
  const str = String(text);
  for (const m of str.matchAll(TOKEN_RE)) {
    if (m.index > last) parts.push(str.slice(last, m.index));
    parts.push({ token: m[0], item: lookup.get(m[0]) || null });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push(str.slice(last));
  return parts;
}

// Plain-text version with values restored (used for read-aloud and calendar text on device).
export function restoreText(text, items, { masked = true } = {}) {
  return splitTokens(text, items)
    .map((p) => (typeof p === 'string' ? p : p.item ? (masked ? displayValue(p.item) : p.item.value) : p.token))
    .join('');
}
