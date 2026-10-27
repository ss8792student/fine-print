import { useRef, useState } from 'react';
import { LANGUAGES, LEVELS, languageLabel } from '../lib/client.js';
import { labelFor, displayValue } from '../lib/redact.js';
import { LockIcon, ShieldIcon } from './Icons.jsx';

const OTHER = '__other__';

export default function Review({
  rawText, setRawText, note, images, prepared, extraHidden, setExtraHidden, allowed, setAllowed,
  language, setLanguage, level, setLevel, error, onBack, onExplain,
}) {
  const { items, segments, redacted } = prepared;
  const tooLong = redacted.length > 15000;
  const textRef = useRef(null);
  const [selHint, setSelHint] = useState('');
  const [zoom, setZoom] = useState(null);
  const known = LANGUAGES.some((l) => l.name === language);
  const [otherMode, setOtherMode] = useState(!known);

  const hideSelection = () => {
    const el = textRef.current;
    if (!el) return;
    const picked = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    if (picked.length < 2) {
      setSelHint('Select a name or other words in the text first, then tap this button.');
      return;
    }
    setSelHint('');
    setExtraHidden([...new Set([...extraHidden, picked])]);
    setAllowed(allowed.filter((a) => a !== picked));
  };

  const unhide = (item) => {
    if (item.type === 'PRIVATE') setExtraHidden(extraHidden.filter((e) => e !== item.value));
    else setAllowed([...new Set([...allowed, item.value])]);
  };

  return (
    <div className="review">
      <h1 className="page-title two-tone">
        <span>Check the text</span>
        <span className="tone-2">before it’s sent</span>
      </h1>
      {note && <p className="muted">{note}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {images.length > 0 && (
        <div className="thumbs" aria-label="Your photos">
          {images.map((src, i) => (
            <button key={src} className="thumb" onClick={() => setZoom(src)} aria-label={`View photo ${i + 1} full size`}>
              <img src={src} alt="" />
            </button>
          ))}
          <p className="muted small">Tap a photo to compare it with the text.</p>
        </div>
      )}

      <div className="field glass card-pad">
        <label htmlFor="letter-text">Letter text</label>
        <textarea
          id="letter-text"
          ref={textRef}
          className="letter-text"
          rows={12}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          spellCheck={false}
        />
        <div className="hide-row">
          <button type="button" className="btn btn-small" onMouseDown={(e) => e.preventDefault()} onClick={hideSelection}>
            <LockIcon width={15} height={15} /> Hide selected text
          </button>
          <span className="muted small">{selHint || 'Select any name or detail above to keep it on your device.'}</span>
        </div>
      </div>

      <section className="privacy-card" aria-labelledby="hidden-heading">
        <div className="privacy-head">
          <span className="shield" aria-hidden="true">
            <ShieldIcon width={22} height={22} />
          </span>
          <div>
            <h2 id="hidden-heading">
              {items.length ? `${items.length} private detail${items.length > 1 ? 's' : ''} stay on this device` : 'No private details found'}
            </h2>
            <p className="small">They’re replaced with placeholders before anything is sent, and put back only on your screen.</p>
          </div>
        </div>
        {items.length > 0 && (
          <ul className="hidden-list">
            {items.map((it) => (
              <li key={it.token}>
                <span className="hidden-what">
                  <span>{labelFor(it.type)}</span>
                  <bdi dir="ltr" className="hidden-value">{displayValue(it)}</bdi>
                </span>
                <button type="button" className="link-button small" onClick={() => unhide(it)}>
                  {it.type === 'PRIVATE' ? 'Remove' : 'Send this one'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {allowed.length > 0 && (
          <p className="small muted">
            You chose to send:{' '}
            {allowed.map((a, i) => (
              <span key={a}>
                {i > 0 && ', '}
                <bdi>{a}</bdi>{' '}
                <button type="button" className="link-button small" onClick={() => setAllowed(allowed.filter((x) => x !== a))}>
                  hide again
                </button>
              </span>
            ))}
          </p>
        )}
        <p className="muted small">
          Fine Print looks for names, street addresses, Social Security, account, case and card numbers, phone numbers, emails and birth dates.
          It can miss some, so check the text and hide anything else you want to keep private.
        </p>
        <details className="sent-preview">
          <summary>See exactly what will be sent</summary>
          <pre>{segments.map((s) => `[${s.id}] ${s.text}`).join('\n')}</pre>
        </details>
      </section>

      <div className="options glass card-pad">
        <div className="field">
          <label htmlFor="language">Explain it in</label>
          <select
            id="language"
            value={otherMode ? OTHER : language}
            onChange={(e) => {
              if (e.target.value === OTHER) {
                setOtherMode(true);
                setLanguage('');
              } else {
                setOtherMode(false);
                setLanguage(e.target.value);
              }
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.name} value={l.name}>
                {languageLabel(l)}
              </option>
            ))}
            <option value={OTHER}>Another language…</option>
          </select>
          {otherMode && (
            <input
              className="text-input"
              type="text"
              maxLength={40}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Type a language, like Hmong or Yoruba"
              aria-label="Language name"
              autoFocus
            />
          )}
        </div>
        <fieldset className="field level-picker">
          <legend>Reading level</legend>
          <div className="segmented">
            {LEVELS.map((l) => (
              <label key={l.id} className={level === l.id ? 'is-on' : ''}>
                <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                <span className="seg-label">{l.label}</span>
                <span className="seg-hint">{l.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {tooLong && <p className="error">This is very long. Try one or two pages at a time.</p>}
      <div className="actions-row">
        <button className="btn btn-primary btn-pill btn-big" disabled={!segments.length || tooLong || !language.trim()} onClick={onExplain}>
          Explain this letter
        </button>
        <button className="btn btn-quiet" onClick={onBack}>
          Use a different letter
        </button>
      </div>

      {zoom && (
        <div className="lightbox" role="dialog" aria-label="Photo" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Your photo of the letter" />
          <button className="btn btn-small" onClick={() => setZoom(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
