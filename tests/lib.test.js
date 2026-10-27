import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, restoreText } from '../src/lib/redact.js';
import { segmentText } from '../src/lib/segment.js';
import { gradeLevel } from '../src/lib/readability.js';
import { missingNumbers, dateAppearsIn, numbersIn } from '../src/lib/checks.js';
import { computeDeadline, parseISO } from '../src/lib/deadlines.js';
import { buildICS } from '../src/lib/calendar.js';
import { SAMPLES } from '../src/samples.js';

test('redacts private details and keeps useful numbers', () => {
  const { text, items } = redact(
    'SSN: 123-45-6789. Account Number: 4402-118-907. Call (555) 014-2290 or email a.b@x.org. ' +
      'Card 4111 1111 1111 1111. Pay $186.42 by 2026-11-12. ZIP 75078-1234. Date of Birth: 03/22/1984.',
  );
  assert.match(text, /\[SSN_1\]/);
  assert.match(text, /\[ACCOUNT_1\]/);
  assert.match(text, /\[PHONE_1\]/);
  assert.match(text, /\[EMAIL_1\]/);
  assert.match(text, /\[CARD_1\]/);
  assert.match(text, /\[DOB_1\]/);
  assert.match(text, /\$186\.42/);
  assert.match(text, /2026-11-12/);
  assert.match(text, /75078-1234/);
  assert.ok(!text.includes('6789'));
  assert.equal(items.length, 6);
  assert.match(restoreText(text, items), /•••-••-6789/);
});

test('same value gets the same placeholder', () => {
  const { text } = redact('Call (555) 014-2290. Again: (555) 014-2290.');
  assert.equal(text.match(/\[PHONE_1\]/g).length, 2);
});

test('sample letters redact and segment sensibly', () => {
  for (const s of SAMPLES) {
    const { text, items } = redact(s.text);
    assert.ok(items.length >= 2, `${s.id}: expected private items, got ${items.length}`);
    const segs = segmentText(text);
    assert.ok(segs.length > 8 && segs.length < 80, `${s.id}: ${segs.length} segments`);
    assert.ok(segs.every((x) => x.text.length <= 400));
  }
});

test('segmenter keeps abbreviations and decimals inside sentences', () => {
  const segs = segmentText('Contact Ms. Ortiz at 8:00 a.m. about the $45.00 fee. Then reply.');
  assert.equal(segs.length, 2);
  assert.match(segs[0].text, /\$45\.00 fee\.$/);
});

test('readability: legalese grades higher than plain text', () => {
  const legal = SAMPLES[0].text;
  const plain = 'You owe $186.42. Pay it by November 12. If you do not pay, they will turn off your water and power. Call them if you need a payment plan.';
  assert.ok(gradeLevel(legal) > gradeLevel(plain) + 4);
});

test('number check catches a changed amount', () => {
  const src = 'a delinquent balance in the amount of $186.42 within thirty (30) days';
  assert.deepEqual(missingNumbers('You owe $186.42 within 30 days.', src), []);
  assert.deepEqual(missingNumbers('You owe $168.42.', src), ['168.42']);
  assert.deepEqual(missingNumbers('Reply within 30 days.', 'within thirty days'), []);
  assert.ok(numbersIn('$1,425.00').has('1425'));
});

test('dates written in words are matched', () => {
  assert.ok(dateAppearsIn('2026-11-12', 'on or after November 12, 2026, unless'));
  assert.ok(dateAppearsIn('2026-11-05', 'Thursday, November 5, 2026 at 3:45'));
  assert.ok(dateAppearsIn('1984-03-22', 'Born 03/22/1984'));
  assert.ok(!dateAppearsIn('2026-11-13', 'on or after November 12, 2026'));
});

test('deadline math', () => {
  const letterDate = parseISO('2026-10-20');
  const r = computeDeadline(
    { kind: 'relative', amount: 30, unit: 'days', anchor: 'letter_date', anchor_text: 'date of this notice' },
    { letterDate, today: parseISO('2026-10-25') },
  );
  assert.equal(r.status, 'ok');
  assert.equal(r.date.toISOString().slice(0, 10), '2026-11-19');
  assert.equal(r.daysLeft, 25);

  const biz = computeDeadline(
    { kind: 'relative', amount: 2, unit: 'business_days', anchor: 'letter_date' },
    { letterDate: parseISO('2026-10-23') }, // Friday
  );
  assert.equal(biz.date.toISOString().slice(0, 10), '2026-10-27');

  const months = computeDeadline(
    { kind: 'relative', amount: 1, unit: 'months', anchor: 'letter_date' },
    { letterDate: parseISO('2026-01-31') },
  );
  assert.equal(months.date.toISOString().slice(0, 10), '2026-02-28');

  const receipt = computeDeadline({ kind: 'relative', amount: 180, unit: 'days', anchor: 'receipt_date' }, {});
  assert.equal(receipt.status, 'needs_receipt');

  assert.equal(parseISO('2026-02-31'), null);
});

test('calendar file is valid-looking', () => {
  const ics = buildICS({ title: 'Pay bill; avoid shutoff', date: parseISO('2026-11-12'), details: 'From Fine Print' });
  assert.match(ics, /DTSTART;VALUE=DATE:20261112/);
  assert.match(ics, /DTEND;VALUE=DATE:20261113/);
  assert.match(ics, /SUMMARY:Pay bill\\; avoid shutoff/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
});

test('business days skip federal holidays', async () => {
  const { computeDeadline, parseISO, federalHolidays } = await import('../src/lib/deadlines.js');
  assert.equal(federalHolidays(2026).get('2026-09-07'), 'Labor Day');
  const r = computeDeadline({ kind: 'relative', amount: 1, unit: 'business_days', anchor: 'letter_date' }, { letterDate: parseISO('2026-09-04') });
  assert.equal(r.date.toISOString().slice(0, 10), '2026-09-08');
  assert.deepEqual(r.steps[1].skipped, ['Labor Day']);
});

test('names and addresses are hidden; generic greetings are not', async () => {
  const { redact } = await import('../src/lib/redact.js');
  const { text, items } = redact('Maria Gonzalez\n410 W. Elm St., Apt 3B\nOak Prairie, TX 75000\n\nDear Maria Gonzalez,\nWe called Ms. Gonzalez.');
  assert.ok(!/Gonzalez|Elm|75000/.test(text), text);
  assert.ok(items.some((i) => i.type === 'NAME') && items.some((i) => i.type === 'ADDRESS'));
  assert.equal(redact('Dear Customer:\nDear Parent/Guardian:').items.length, 0);
  const custom = redact('Call Dr. Smith today.', { extra: ['Dr. Smith'] });
  assert.match(custom.text, /\[PRIVATE_1\]/);
  const allowed = redact('Dear Maria Gonzalez,', { allow: ['Maria Gonzalez'] });
  assert.equal(allowed.items.length, 0);
});

test('server repairs broken accents and hides internal ids', async () => {
  const { repairMojibake, scrubIds } = await import('../api/claude.js');
  assert.equal(repairMojibake('recertificaciĂłn en 10 dĂ­as ÂżDĂłnde?'), 'recertificación en 10 días ¿Dónde?');
  assert.equal(repairMojibake('informaciÃ³n'), 'información');
  assert.equal(repairMojibake('Tiếng Việt Ăn'), 'Tiếng Việt Ăn');
  assert.equal(scrubIds('Segment S16 contains text that tries to give instructions.', true), 'One part of the letter contains text that tries to give instructions.');
});

test('translations must keep placeholders', async () => {
  const { makeT } = await import('../src/lib/i18n.js');
  const t = makeT({ days_in: 'En {n} días', sum_plain: 'Versión sencilla: coincide' });
  assert.equal(t('days_in', { n: 5 }), 'En 5 días');
  assert.match(t('sum_plain', { ok: 1, total: 2 }), /1 of 2/); // fell back to English
});

test('a number found elsewhere in the letter is added as a source, not flagged', async () => {
  const { prepare, sanitizeResult, addMissingSources, localChecks } = await import('../src/lib/analyze.js');
  const p = prepare(SAMPLES[0].text);
  const amountSeg = p.segments.find((s) => s.text.includes('186.42')).id;
  const shutoffSeg = p.segments.find((s) => s.text.includes('Pursuant')).id;
  let r = sanitizeResult({
    plain_sentences: [],
    actions: [
      { task: 'Pay the full balance of $186.42 before November 12, 2026.', source_ids: [shutoffSeg] },
      { task: 'Pay $999.99 before November 12, 2026.', source_ids: [shutoffSeg] },
    ],
  }, p.segments);
  r = addMissingSources(r, p.segments);
  assert.deepEqual(r.actions[0].source_ids, [shutoffSeg, amountSeg]);
  const segById = new Map(p.segments.map((s) => [s.id, s]));
  const local = localChecks(r, segById);
  assert.deepEqual(local.a1.missing, []);
  assert.deepEqual(local.a2.missing, ['999.99']);
});

test('Spanish labels are complete', async () => {
  const { EN } = await import('../src/lib/i18n.js');
  const { ES } = await import('../src/lib/i18n-es.js');
  for (const k of Object.keys(EN)) assert.ok(ES[k], `missing Spanish label: ${k}`);
});
