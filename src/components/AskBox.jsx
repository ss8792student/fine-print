import { useRef, useState } from 'react';
import TokenText from './TokenText.jsx';
import { CheckIcon, AlertIcon } from './Icons.jsx';
import { callServer } from '../lib/client.js';
import { redact } from '../lib/redact.js';
import { missingNumbers, sourceNumbers } from '../lib/checks.js';

// Questions about the letter. Answers come only from the letter and cite the passages
// they used; code then checks that every number in the answer appears in those passages.
export default function AskBox({ segments, items, language, level, t, qa, onChange }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openSources, setOpenSources] = useState(null);
  const inputRef = useRef(null);
  const segById = new Map(segments.map((s) => [s.id, s]));

  // Replace any private value the person types with its placeholder; hide other new ones.
  const prepareQuestion = (q) => {
    let out = q;
    for (const it of [...items].sort((a, b) => b.value.length - a.value.length)) out = out.split(it.value).join(it.token);
    const extra = redact(out);
    let safe = out;
    for (const it of extra.items) if (!/^\[/.test(it.value)) safe = safe.split(it.value).join('[hidden]');
    return safe;
  };

  const groundAnswer = (answer, ids) => {
    const valid = ids.filter((id) => segById.has(id));
    const text = valid.map((id) => segById.get(id).text).join(' ');
    let missing = missingNumbers(answer, text);
    const added = [];
    for (const n of missing) {
      const hit = segments.find((s) => sourceNumbers(s.text).has(n));
      if (hit && !valid.includes(hit.id) && !added.includes(hit.id)) added.push(hit.id);
    }
    const all = [...valid, ...added];
    missing = missingNumbers(answer, all.map((id) => segById.get(id).text).join(' '));
    return { source_ids: all, missing };
  };

  const ask = async (q) => {
    const typed = q.trim();
    if (!typed || busy) return;
    setBusy(true);
    setError('');
    setQuestion('');
    const pending = [...qa, { q: typed, status: 'pending' }];
    onChange(pending);
    try {
      const data = await callServer({
        task: 'ask',
        language,
        level,
        question: prepareQuestion(typed),
        segments: segments.map(({ id, text }) => ({ id, text })),
        history: qa.filter((x) => x.status === 'done').map((x) => ({ q: prepareQuestion(x.q), a: x.answer })),
      });
      const r = data.result || {};
      const answer = String(r.answer || '');
      const found = r.found !== false;
      const { source_ids, missing } = found ? groundAnswer(answer, Array.isArray(r.source_ids) ? r.source_ids : []) : { source_ids: [], missing: [] };
      onChange([...qa, { q: typed, status: 'done', answer, found, source_ids, missing }]);
    } catch (err) {
      onChange(qa);
      setQuestion(typed);
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ask glass">
      <h2>{t('ask_title')}</h2>
      <p className="muted small">{t('ask_hint')}</p>

      {qa.length > 0 && (
        <ul className="qa">
          {qa.map((x, i) => (
            <li key={i}>
              <p className="q-bubble">{x.q}</p>
              {x.status === 'pending' ? (
                <p className="a-bubble muted">
                  <span className="spinner" aria-hidden="true" /> {t('ask_thinking')}
                </p>
              ) : (
                <div className="a-bubble">
                  <p>
                    <TokenText text={x.answer} items={items} />
                  </p>
                  {x.found ? (
                    <>
                      <button className={`badge ${x.missing?.length ? 'badge-warn' : 'badge-ok'} badge-button`} onClick={() => setOpenSources(openSources === i ? null : i)} aria-expanded={openSources === i}>
                        {x.missing?.length ? <AlertIcon width={14} height={14} /> : <CheckIcon width={14} height={14} />}
                        {t('ask_based')}
                      </button>
                      {x.missing?.length > 0 && <p className="small warn-text">{t('ask_check_numbers', { numbers: x.missing.join(', ') })}</p>}
                      {openSources === i &&
                        x.source_ids.map((id) => (
                          <blockquote key={id} className="source-quote" dir="auto">
                            <mark>
                              <TokenText text={segById.get(id)?.text || ''} items={items} />
                            </mark>
                          </blockquote>
                        ))}
                    </>
                  ) : (
                    <span className="badge badge-pending">{t('ask_not_said')}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {qa.length === 0 && (
        <div className="suggest">
          {['ask_s1', 'ask_s2', 'ask_s3'].map((k) => (
            <button key={k} className="chip-button" disabled={busy} onClick={() => ask(t(k))}>
              {t(k)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error small">{error}</p>}

      <form
        className="ask-bar"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={question}
          maxLength={300}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('ask_placeholder')}
          aria-label={t('ask_title')}
        />
        <button type="submit" className="btn btn-primary btn-pill btn-small" disabled={busy || !question.trim()}>
          {t('ask_send')}
        </button>
      </form>
    </section>
  );
}
