import { useEffect, useMemo, useRef, useState } from 'react';
import TokenText from './TokenText.jsx';
import AskBox from './AskBox.jsx';
import { CheckIcon, AlertIcon, XIcon, SpeakerIcon, StopIcon, CalendarIcon, ChevronIcon, BookmarkIcon, BellIcon } from './Icons.jsx';
import { gradeLevel } from '../lib/readability.js';
import { groundedLetterDate, deadlineGrounding } from '../lib/analyze.js';
import { computeDeadline, formatDate, parseISO, toISO, todayUTC, addPeriod } from '../lib/deadlines.js';
import { downloadICS, googleCalendarUrl } from '../lib/calendar.js';
import { languageInfo, canSpeak, speak, stopSpeaking } from '../lib/client.js';
import { splitTokens, labelFor } from '../lib/redact.js';
import { periodText, daysLeftText } from '../lib/i18n.js';

function Badge({ level, compact, t }) {
  const Icon = level === 'ok' ? CheckIcon : level === 'bad' ? XIcon : level === 'warn' ? AlertIcon : null;
  const text = t(`badge_${level}`);
  return (
    <span className={`badge badge-${level}${compact ? ' badge-compact' : ''}`} title={text}>
      {Icon ? <Icon width={14} height={14} /> : <span className="spinner" aria-hidden="true" />}
      <span className={compact ? 'visually-hidden' : ''}>{text}</span>
    </span>
  );
}

function badgeNote(badge, t) {
  if (badge.level === 'pending') return t('badge_pending');
  const parts = [];
  if (badge.noSource) parts.push(t('note_no_source'));
  if (badge.noResult) parts.push(t('note_no_result'));
  if (badge.reason) parts.push(badge.reason);
  if (badge.missing?.length) parts.push(t('note_code', { numbers: badge.missing.join(', ') }));
  if (!parts.length) parts.push(t('note_ok'));
  return parts.join(' ');
}

function Claim({ claim, badge, items, segById, expanded, onToggle, onShowOriginal, lead, t }) {
  return (
    <li className={`claim${expanded ? ' is-open' : ''}${lead ? ' has-lead' : ''}`}>
      <div className="claim-row">
        {lead}
        <button className="claim-main" onClick={onToggle} aria-expanded={expanded}>
          <span className="claim-text">
            <TokenText text={claim.text} items={items} />
          </span>
          <Badge level={badge.level} compact t={t} />
        </button>
      </div>
      {expanded && (
        <div className="claim-source">
          <p className="source-label">{t('from_letter')}</p>
          {claim.source_ids.length ? (
            claim.source_ids.map((id) => (
              <blockquote key={id} className="source-quote" dir="auto">
                <mark>
                  <TokenText text={segById.get(id)?.text || ''} items={items} />
                </mark>
              </blockquote>
            ))
          ) : (
            <p className="muted small">{t('no_source')}</p>
          )}
          <div className={`check-note note-${badge.level}`}>
            <Badge level={badge.level} t={t} />
            <span>{badgeNote(badge, t)}</span>
          </div>
          {claim.source_ids.length > 0 && (
            <button className="link-button" onClick={() => onShowOriginal(claim.source_ids)}>
              {t('show_in_letter')}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function spokenText(text, items) {
  return splitTokens(text, items)
    .map((p) => {
      if (typeof p === 'string') return p;
      if (!p.item) return '';
      if (['PHONE', 'EMAIL', 'NAME', 'ADDRESS', 'PRIVATE'].includes(p.item.type)) return p.item.value;
      return `your ${labelFor(p.item.type).toLowerCase()}`;
    })
    .join('');
}

function gradeText(g, t) {
  if (g == null) return '—';
  if (g >= 16) return t('grade_college_grad');
  if (g >= 13) return t('grade_college');
  return t('grade_n', { n: Math.round(g) });
}

function stepText(step, t, locale) {
  switch (step.k) {
    case 'direct':
      return [t('step_direct')];
    case 'unreadable':
      return [t('step_unreadable')];
    case 'unclear':
      return [t('step_unclear', { text: step.text || '…' })];
    case 'start':
      return [t(step.anchor === 'receipt_date' ? 'step_start_receipt' : 'step_start_letter', { date: formatDate(step.date, locale) })];
    case 'add': {
      const lines = [t('step_add', { period: periodText(t, step.amount, step.unit) })];
      if (step.unit === 'business_days') {
        lines.push(t('step_weekends'));
        if (step.skipped?.length) lines.push(t('step_holidays', { list: [...new Set(step.skipped)].join(', ') }));
      }
      return lines;
    }
    case 'result':
      return [t('step_result', { date: formatDate(step.date, locale) })];
    default:
      return [];
  }
}

function TrustRing({ ok, total, checking, failed, t }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const frac = total ? ok / total : 0;
  const state = checking ? 'checking' : failed ? 'failed' : ok === total ? 'all' : 'some';
  return (
    <div className={`ring ring-${state}`} role="img" aria-label={checking ? t('checking_all') : `${ok} / ${total} ${t('ring_label')}`}>
      <svg viewBox="0 0 72 72" width="76" height="76" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className="ring-track" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="ring-fill"
          strokeDasharray={checking ? `${c * 0.22} ${c}` : `${c * frac} ${c}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className="ring-text">
        {checking || failed ? (
          <span className="ring-num">…</span>
        ) : (
          <span className="ring-num">
            {ok}/{total}
          </span>
        )}
        <span className="ring-label">{checking ? t('badge_pending') : t('ring_label')}</span>
      </span>
    </div>
  );
}

function WeekStrip({ next, t, locale, onOpen }) {
  const today = todayUTC();
  const deadline = next.calc.date;
  const n = next.calc.daysLeft;
  const start = n <= 6 ? today : addPeriod(deadline, -3, 'days');
  const days = Array.from({ length: 7 }, (_, i) => addPeriod(start, i, 'days'));
  const same = (a, b) => toISO(a) === toISO(b);
  const fmt = (d, o) => formatDate(d, locale, { weekday: undefined, year: undefined, ...o });
  const range = `${fmt(days[0], { month: 'short' })} – ${fmt(days[6], { month: 'short' })}`;
  return (
    <button className={`week glass${n <= 14 ? ' is-soon' : ''}`} onClick={onOpen}>
      <span className="week-head">
        <span className="week-title">{t('next_deadline')}</span>
        <span className="week-range">{range}</span>
      </span>
      <span className="week-what">
        <span className="week-when">{daysLeftText(t, n)}</span>
        <span className="week-label">{next.dl.label}</span>
      </span>
      <span className="week-days" aria-hidden="true">
        {days.map((d) => {
          const isDeadline = same(d, deadline);
          const isToday = same(d, today);
          const between = d >= today && d < deadline;
          return (
            <span key={toISO(d)} className={`day${isDeadline ? ' is-deadline' : ''}${isToday ? ' is-today' : ''}`}>
              <span className="day-name">{formatDate(d, locale, { weekday: 'narrow', month: undefined, day: undefined, year: undefined })}</span>
              <span className="day-num">{d.getUTCDate()}</span>
              <span className={`day-dot${between || isDeadline ? ' on' : ''}`} />
            </span>
          );
        })}
      </span>
    </button>
  );
}

export default function Results({ analysis, t, onEdit, onStartOver, onSave, onQaChange }) {
  const { prepared, result, badges: finalBadges, local, verdicts, verifyError, sent, language, level } = analysis;
  const { segments, items } = prepared;
  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const lang = languageInfo(language, result.gist);
  const dir = lang.rtl ? 'rtl' : 'ltr';
  const locale = lang.code || 'en-US';

  const [tab, setTab] = useState('plain');
  const [open, setOpen] = useState(null);
  const [highlight, setHighlight] = useState(new Set());
  const [done, setDone] = useState(new Set());
  const [receiptISO, setReceiptISO] = useState('');
  const [letterISO, setLetterISO] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [selectedSeg, setSelectedSeg] = useState(null);
  const originalRef = useRef(null);

  useEffect(() => () => stopSpeaking(), []);

  const badges = finalBadges || Object.fromEntries(Object.keys(local).map((id) => [id, { level: 'pending', missing: [] }]));
  const checking = !verdicts;
  const tally = (list) => list.reduce((acc, c) => ((acc[badges[c.id]?.level || 'pending'] += 1), acc), { ok: 0, warn: 0, bad: 0, pending: 0 });
  const plainCount = tally(result.plain_sentences);
  const todoCount = tally(result.actions);
  const flags = (c) => c.warn + c.bad;

  // Readability before and after (English output only).
  const originalGrade = gradeLevel(segments.map((s) => s.text).join(' '));
  const plainGrade = /^english$/i.test(language) ? gradeLevel(result.plain_sentences.map((p) => p.text).join(' ')) : null;

  // Deadlines, calculated in code.
  const letterInfo = groundedLetterDate(result, segments, segById);
  const letterDate = letterISO ? parseISO(letterISO) : letterInfo.date;
  const receiptDate = receiptISO ? parseISO(receiptISO) : null;
  const deadlines = result.deadlines
    .map((dl) => ({ dl, calc: computeDeadline(dl, { letterDate, receiptDate }), ground: deadlineGrounding(dl, segById) }))
    .sort((a, b) => (a.calc.date && b.calc.date ? a.calc.date - b.calc.date : a.calc.date ? -1 : 1));
  const next = deadlines.find((d) => d.calc.date && d.calc.daysLeft >= 0);
  const passed = deadlines.filter((d) => d.calc.date && d.calc.daysLeft < 0);
  const nextAction = result.actions.find((a) => !done.has(a.id));

  // Reverse map: which plain sentences cite each piece of the letter.
  const citedBy = useMemo(() => {
    const map = new Map();
    for (const c of [...result.plain_sentences, ...result.actions]) for (const id of c.source_ids) map.set(id, [...(map.get(id) || []), c]);
    return map;
  }, [result]);

  // Group the letter's pieces back into its real paragraphs and lines.
  const paragraphs = useMemo(() => {
    const out = [[]];
    for (const s of segments) {
      out[out.length - 1].push(s);
      if (s.after === 'para') out.push([]);
    }
    return out.filter((p) => p.length);
  }, [segments]);

  const showOriginal = (ids) => {
    setHighlight(new Set(ids));
    setSelectedSeg(null);
    setTab('original');
    requestAnimationFrame(() => {
      const el = originalRef.current?.querySelector(`[data-seg="${ids[0]}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = [result.gist, ...result.plain_sentences.map((p) => p.text)].map((s) => spokenText(s, items)).join(' ');
    setSpeaking(true);
    speak(text, lang.code, () => setSpeaking(false));
  };

  const claimProps = (c) => ({
    claim: c,
    badge: badges[c.id] || { level: 'pending', missing: [] },
    items,
    segById,
    t,
    expanded: open === c.id,
    onToggle: () => setOpen(open === c.id ? null : c.id),
    onShowOriginal: showOriginal,
  });

  const tabs = [
    { id: 'plain', label: t('tab_plain'), flag: flags(plainCount) },
    { id: 'todo', label: t('tab_todo'), count: result.actions.length, flag: flags(todoCount) },
    { id: 'deadlines', label: t('tab_deadlines'), count: result.deadlines.length, flag: passed.length },
    { id: 'original', label: t('tab_original') },
  ];

  const calTitle = (dl) => (result.sender ? `${dl.label} — ${result.sender}` : dl.label);
  const futureDeadlines = deadlines.filter((d) => d.calc.date && d.calc.daysLeft >= 0);
  const [justSaved, setJustSaved] = useState(false);
  const save = () => {
    const ok = onSave(deadlines.filter((d) => d.calc.date).map((d) => ({ label: d.dl.label, date: toISO(d.calc.date) })));
    if (ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    }
  };
  const remindAll = () =>
    downloadICS(
      futureDeadlines.map((d) => ({ title: calTitle(d.dl), date: d.calc.date, details: t('cal_details') })),
      'fine-print-deadlines.ics',
    );

  return (
    <div className="results" dir={dir} lang={lang.code || undefined}>
      <section className="results-head">
        <div className="head-row">
          <h1 className="two-tone doc-title">
            <span>{result.document_type || t('tab_original')}</span>
            {result.sender && <span className="tone-2">{result.sender}</span>}
          </h1>
          <TrustRing ok={plainCount.ok + todoCount.ok} total={result.plain_sentences.length + result.actions.length} checking={checking} failed={!!verifyError} t={t} />
        </div>

        {passed.length > 0 && (
          <button className="passed-banner" onClick={() => setTab('deadlines')}>
            <AlertIcon width={18} height={18} />
            <span>{t('passed_banner')}</span>
          </button>
        )}

        <div className="focus-stack">
          <div className="focus glass">
            <div className="focus-top">
              <span className="focus-label">{t('in_short')}</span>
              <span className={`stamp stamp-${result.urgency}`}>{t(`urgency_${result.urgency}`)}</span>
            </div>
            <p className="gist">
              <TokenText text={result.gist} items={items} />
            </p>
            {result.urgency_reason && <p className="urgency-reason">{result.urgency_reason}</p>}
          </div>
          {nextAction && (
            <button className="next-step" onClick={() => setTab('todo')}>
              <span className="next-label">{t('next_step')}</span>
              <span className="next-what">
                <TokenText text={nextAction.text} items={items} />
              </span>
              <ChevronIcon width={18} height={18} className="flip-rtl" />
            </button>
          )}
        </div>

        {next && <WeekStrip next={next} t={t} locale={locale} onOpen={() => setTab('deadlines')} />}

        <div className="trust-card glass">
          <div className="trust" aria-live="polite">
            {checking ? (
              <p>
                <span className="spinner" aria-hidden="true" /> {t('checking_all')}
              </p>
            ) : verifyError ? (
              <p>{t('checker_failed')}</p>
            ) : (
              <>
                <p className="trust-line">
                  <Badge level={flags(plainCount) ? 'warn' : 'ok'} compact t={t} />
                  {t('sum_plain', { ok: plainCount.ok, total: result.plain_sentences.length })}
                </p>
                {result.actions.length > 0 && (
                  <p className="trust-line">
                    <Badge level={flags(todoCount) ? 'warn' : 'ok'} compact t={t} />
                    {t('sum_todo', { ok: todoCount.ok, total: result.actions.length })}
                  </p>
                )}
                {flags(plainCount) + flags(todoCount) > 0 && <p className="muted small">{t('sum_flag_hint')}</p>}
              </>
            )}
          </div>
          {originalGrade && (
            <div className="grades">
              <div className="grade">
                <span className="grade-label">{t('grade_original')}</span>
                <span className="grade-bar">
                  <span style={{ width: `${(originalGrade / 18) * 100}%` }} />
                </span>
                <span className="grade-value">{gradeText(originalGrade, t)}</span>
              </div>
              {plainGrade ? (
                <div className="grade grade-plain">
                  <span className="grade-label">{t('grade_plain')}</span>
                  <span className="grade-bar">
                    <span style={{ width: `${(plainGrade / 18) * 100}%` }} />
                  </span>
                  <span className="grade-value">{gradeText(plainGrade, t)}</span>
                </div>
              ) : (
                <p className="muted small grade-note">{t('grade_note')}</p>
              )}
            </div>
          )}
        </div>
        <div className="save-row">
          <button className={`btn btn-pill btn-small${analysis.savedId ? ' is-saved' : ''}`} onClick={save}>
            <BookmarkIcon width={16} height={16} />
            {justSaved ? t('saved') : analysis.savedId ? t('update_saved') : t('save_letter')}
          </button>
          {futureDeadlines.length > 0 && (
            <button className="btn btn-primary btn-pill btn-small" onClick={remindAll}>
              <BellIcon width={16} height={16} />
              {t('remind_all')}
            </button>
          )}
          {futureDeadlines.length > 0 && <p className="muted small save-note">{t('remind_note')}</p>}
        </div>

        <AskBox segments={segments} items={items} language={language} level={level} t={t} qa={analysis.qa || []} onChange={onQaChange} />
      </section>

      <nav className="tabs" role="tablist">
        {tabs.map((tb) => (
          <button key={tb.id} role="tab" aria-selected={tab === tb.id} className={tab === tb.id ? 'is-on' : ''} onClick={() => setTab(tb.id)}>
            <span className="tab-label">{tb.label}</span>
            {tb.count > 0 && <span className="tab-count">{tb.count}</span>}
            {tb.flag > 0 && (
              <span className="tab-flag" aria-label={`${tb.flag} ${t('badge_warn')}`}>
                !
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'plain' && (
        <section className="panel" role="tabpanel">
          <div className="panel-head">
            <p className="muted small">{t('tap_hint')}</p>
            {canSpeak() && (
              <button className="btn btn-small" onClick={toggleSpeak} aria-pressed={speaking}>
                {speaking ? <StopIcon width={16} height={16} /> : <SpeakerIcon width={16} height={16} />}
                {speaking ? t('stop') : t('read_aloud')}
              </button>
            )}
          </div>
          <ul className="claims glass">
            {result.plain_sentences.map((c) => (
              <Claim key={c.id} {...claimProps(c)} />
            ))}
          </ul>

          {result.glossary.length > 0 && (
            <div className="extra glass">
              <h2>{t('words_heading')}</h2>
              <dl className="glossary">
                {result.glossary.map((g) => (
                  <div key={g.term}>
                    <dt dir="auto">{g.term}</dt>
                    <dd>{g.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {result.questions_to_ask.length > 0 && (
            <div className="extra glass">
              <h2>{t('questions_heading')}</h2>
              <ul className="questions">
                {result.questions_to_ask.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === 'todo' && (
        <section className="panel" role="tabpanel">
          {result.actions.length ? (
            <ul className="claims todo glass">
              {result.actions.map((c) => (
                <Claim
                  key={c.id}
                  {...claimProps(c)}
                  lead={
                    <input
                      type="checkbox"
                      className="todo-check"
                      aria-label={t('mark_done')}
                      checked={done.has(c.id)}
                      onChange={() => {
                        const n = new Set(done);
                        n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                        setDone(n);
                      }}
                    />
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="empty">{t('no_actions')}</p>
          )}
        </section>
      )}

      {tab === 'deadlines' && (
        <section className="panel" role="tabpanel">
          {deadlines.length === 0 && <p className="empty">{t('no_deadlines')}</p>}
          <ul className="deadlines">
            {deadlines.map(({ dl, calc, ground }) => {
              const isPast = calc.date && calc.daysLeft < 0;
              const isSoon = calc.date && calc.daysLeft >= 0 && calc.daysLeft <= 14;
              return (
                <li key={dl.id} className={`deadline glass${isSoon ? ' is-soon' : ''}${isPast ? ' is-past' : ''}`}>
                  <p className="deadline-label">{dl.label}</p>

                  {calc.status === 'ok' && (
                    <>
                      <p className="deadline-date">{formatDate(calc.date, locale)}</p>
                      <p className="deadline-left">{daysLeftText(t, calc.daysLeft)}</p>
                    </>
                  )}

                  {isPast && (
                    <div className="passed-callout" role="alert">
                      <AlertIcon width={18} height={18} />
                      <div>
                        <strong>{t('passed_title')}</strong>
                        <p>{t('passed_body')}</p>
                      </div>
                    </div>
                  )}

                  {dl.kind === 'relative' && dl.anchor === 'receipt_date' && (
                    <div className="ask-date">
                      <label htmlFor={`r-${dl.id}`}>{calc.status === 'needs_receipt' ? t('ask_receipt') : t('received_label')}</label>
                      <div className="ask-row">
                        <input id={`r-${dl.id}`} type="date" value={receiptISO} onChange={(e) => setReceiptISO(e.target.value)} />
                        <button className="btn btn-small" onClick={() => setReceiptISO(toISO(todayUTC()))}>
                          {t('today')}
                        </button>
                      </div>
                    </div>
                  )}

                  {dl.kind === 'relative' && dl.anchor === 'letter_date' && (
                    <div className="ask-date">
                      <label htmlFor={`l-${dl.id}`}>{calc.status === 'needs_letter_date' ? t('ask_letter_date') : t('letter_date_label')}</label>
                      <div className="ask-row">
                        <input
                          id={`l-${dl.id}`}
                          type="date"
                          value={letterISO || (letterInfo.date ? toISO(letterInfo.date) : '')}
                          onChange={(e) => setLetterISO(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {calc.steps.length > 0 && (
                    <div className="math">
                      <p className="source-label">{t('math_heading')}</p>
                      <ol>
                        {calc.steps.flatMap((s) => stepText(s, t, locale)).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ol>
                      {dl.kind === 'relative' && dl.anchor === 'letter_date' && !letterISO && letterInfo.date && !letterInfo.grounded && (
                        <p className="warn-text">{t('letter_date_unconfirmed')}</p>
                      )}
                    </div>
                  )}

                  <p className={`ground ${ground.ok ? 'ground-ok' : 'ground-warn'}`}>
                    {ground.ok ? <CheckIcon width={14} height={14} /> : <AlertIcon width={14} height={14} />} {t(ground.key, ground.vars)}
                  </p>

                  {dl.source_ids.length > 0 && (
                    <blockquote className="source-quote" dir="auto">
                      <mark>
                        <TokenText text={dl.source_ids.map((id) => segById.get(id)?.text).join(' ')} items={items} />
                      </mark>
                    </blockquote>
                  )}

                  {calc.date && calc.daysLeft >= 0 && (
                    <div className="cal-buttons">
                      <button className="btn btn-small" onClick={() => downloadICS([{ title: calTitle(dl), date: calc.date, details: t('cal_details') }])}>
                        <CalendarIcon width={16} height={16} /> {t('cal_apple')}
                      </button>
                      <a className="btn btn-small" target="_blank" rel="noreferrer" href={googleCalendarUrl({ title: calTitle(dl), date: calc.date, details: t('cal_details') })}>
                        <CalendarIcon width={16} height={16} /> {t('cal_google')}
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'original' && (
        <section className="panel" role="tabpanel">
          <p className="muted small">{t('original_hint')}</p>
          <div className="original" ref={originalRef} dir="auto">
            {paragraphs.map((para) => (
              <p key={para[0].id}>
                {para.map((s) => {
                  const users = citedBy.get(s.id) || [];
                  const isHi = highlight.has(s.id);
                  return (
                    <span key={s.id}>
                      <span
                        data-seg={s.id}
                        role="button"
                        tabIndex={0}
                        className={`seg${isHi ? ' is-hi' : ''}${users.length ? ' is-used' : ''}`}
                        onClick={() => {
                          setSelectedSeg(selectedSeg === s.id ? null : s.id);
                          setHighlight(new Set([s.id]));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                      >
                        <TokenText text={s.text} items={items} />
                      </span>
                      {selectedSeg === s.id && (
                        <span className="seg-pop" dir={dir}>
                          {users.length ? (
                            users.map((c) => (
                              <span key={c.id} className="seg-pop-line">
                                <TokenText text={c.text} items={items} />
                              </span>
                            ))
                          ) : (
                            <span className="seg-pop-line muted">{t('not_used')}</span>
                          )}
                        </span>
                      )}
                      {s.after === 'line' ? <br /> : s.after === 'space' ? ' ' : null}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="after">
        <details className="sent-preview">
          <summary>{t('sent_heading')}</summary>
          <p className="muted small">{t('sent_note')}</p>
          <pre dir="ltr">{JSON.stringify({ language: sent.language, reading_level: level, letter: sent.segments.map((s) => `[${s.id}] ${s.text}`) }, null, 2)}</pre>
        </details>
        <div className="actions-row">
          <button className="btn" onClick={onEdit}>
            {t('fix_text')}
          </button>
          <button className="btn btn-quiet" onClick={onStartOver}>
            {t('another')}
          </button>
        </div>
      </section>
    </div>
  );
}
