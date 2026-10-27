import { useRef, useState } from 'react';
import { SAMPLES } from '../samples.js';
import { CameraIcon, UploadIcon, PasteIcon, CheckIcon, ArrowUpRightIcon, BellIcon, TrashIcon, ChevronIcon } from './Icons.jsx';
import { upcomingDeadlines } from '../lib/saved.js';
import { todayUTC, parseISO, formatDate } from '../lib/deadlines.js';
import { daysLeftText, tEnglish } from '../lib/i18n.js';

export default function Home({ onFiles, onPaste, onSample, reading, error, saved = [], onOpenSaved, onDeleteSaved }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  const today = todayUTC();
  const upcoming = upcomingDeadlines(saved, today).filter((d) => d.daysLeft >= -7 && d.daysLeft <= 14);
  const nextFor = (entry) => upcomingDeadlines([entry], today).find((d) => d.daysLeft >= 0);

  const pick = (e) => {
    onFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="home">
      {upcoming.length > 0 && (
        <section className="coming glass" aria-labelledby="coming-heading">
          <h2 id="coming-heading">
            <BellIcon width={18} height={18} /> Coming up
          </h2>
          <ul>
            {upcoming.slice(0, 4).map((d, i) => (
              <li key={i}>
                <button className={`coming-item${d.daysLeft < 0 ? ' is-past' : d.daysLeft <= 3 ? ' is-soon' : ''}`} onClick={() => onOpenSaved(d.letterId)}>
                  <span className="coming-when">{d.daysLeft < 0 ? `Passed ${daysLeftText(tEnglish, d.daysLeft).toLowerCase()}` : daysLeftText(tEnglish, d.daysLeft)}</span>
                  <span className="coming-what">
                    {d.label}
                    <span className="muted"> · {d.title}</span>
                  </span>
                  <ChevronIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="hero">
        <h1 className="two-tone">
          <span>Official letters,</span>
          <span className="tone-2">in words you can act on.</span>
        </h1>
        <p className="lede">
          Photograph a confusing notice from a school, landlord, utility or agency. Fine Print rewrites it plainly, finds your deadlines,
          and shows you exactly where each sentence came from.
        </p>

        <figure className="demo glass" aria-label="Example: a sentence from a shutoff notice and its plain version">
          <blockquote className="demo-original">
            Pursuant to the Utility’s Tariff and Terms of Service, please be advised that electric and water service to the premises identified
            above is subject to <mark className="sweep">disconnection on or after November 12, 2026, unless the delinquent balance is remitted in full</mark>{' '}
            or a deferred payment arrangement is executed prior to such date.
          </blockquote>
          <div className="demo-plain">
            <p>Your power and water could be shut off on November 12, 2026, unless you pay what you owe or set up a payment plan.</p>
            <span className="badge badge-ok">
              <CheckIcon width={14} height={14} />
              Matches the original
            </span>
          </div>
        </figure>
      </section>

      {reading ? (
        <section className="reading glass" aria-live="polite">
          <span className="upload-icon" aria-hidden="true">
            <span className="spinner" />
          </span>
          <p className="reading-label">{reading.label}…</p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reading.progress * 100)}>
            <span style={{ width: `${Math.max(4, reading.progress * 100)}%` }} />
          </div>
          <p className="muted small">The first time takes a little longer while the text reader loads. Your photo stays on this device.</p>
        </section>
      ) : (
        <section className="start" aria-label="Add a letter">
          {error && <p className="error" role="alert">{error}</p>}

          <div className="upload-zone">
            <span className="upload-icon" aria-hidden="true">
              <CameraIcon width={26} height={26} />
            </span>
            <p className="upload-title">Add the letter you got</p>
            <p className="muted small">A photo, a few photos, or a PDF. It’s read right on this device.</p>
            <button className="btn btn-primary btn-pill" onClick={() => cameraRef.current?.click()}>
              <span className="btn-icon" aria-hidden="true">
                <CameraIcon width={16} height={16} />
              </span>
              Take a photo of a letter
            </button>
            <button className="btn btn-ghost btn-pill" onClick={() => uploadRef.current?.click()}>
              <UploadIcon width={18} height={18} />
              Upload photos or a PDF
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <input ref={uploadRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={pick} />

          {pasting ? (
            <div className="paste-box glass">
              <label htmlFor="paste">Letter text</label>
              <textarea id="paste" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the letter or email here" autoFocus />
              {pasted.trim().length > 0 && pasted.trim().length < 20 && <p className="muted small">Paste at least a full sentence from the letter to continue.</p>}
              <div className="paste-actions">
                <button className="btn btn-primary btn-pill" disabled={pasted.trim().length < 20} onClick={() => onPaste(pasted)}>
                  Continue
                </button>
                <button className="btn btn-quiet" onClick={() => setPasting(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="pill-input" onClick={() => setPasting(true)}>
              <PasteIcon width={18} height={18} />
              <span>Or paste the letter’s text…</span>
            </button>
          )}

          {saved.length > 0 && (
            <div className="saved-list">
              <h2>Your saved letters</h2>
              <p className="muted small">Saved only on this phone.</p>
              <ul>
                {saved.map((e) => {
                  const next = nextFor(e);
                  return (
                    <li key={e.id} className="saved-item glass">
                      <button className="saved-open" onClick={() => onOpenSaved(e.id)}>
                        <span className="saved-title">{e.title}</span>
                        <span className="saved-meta">
                          {e.sender && <span>{e.sender}</span>}
                          {next ? (
                            <span className={next.daysLeft <= 3 ? 'due-soon' : ''}>
                              {next.label}: {formatDate(parseISO(next.date), 'en-US', { weekday: undefined, year: undefined })}
                            </span>
                          ) : (
                            <span>Saved {new Date(e.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                        </span>
                      </button>
                      <button className="icon-button" onClick={() => onDeleteSaved(e.id)} aria-label={`Delete saved letter: ${e.title}`}>
                        <TrashIcon width={18} height={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="samples">
            <h2>No letter handy? Try a sample.</h2>
            <ul>
              {SAMPLES.map((s) => (
                <li key={s.id}>
                  <button className={`sample sample-${s.id}`} onClick={() => onSample(s)}>
                    <span className="sample-art" aria-hidden="true">
                      <span className="sample-go">
                        <ArrowUpRightIcon width={15} height={15} />
                      </span>
                    </span>
                    <span className="sample-text">
                      <span className="sample-title">{s.title}</span>
                      <span className="sample-from">{s.from} (made up)</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="how glass">
        <h2>What happens to your letter</h2>
        <ol className="how-steps">
          <li>
            <strong>Read on your phone.</strong> The text is pulled from your photo right on this device. The photo is never uploaded.
          </li>
          <li>
            <strong>Private details hidden.</strong> Names, addresses, Social Security, account and card numbers, phone numbers and emails are
            replaced with placeholders before anything is sent. You can hide anything else yourself and see exactly what gets sent.
          </li>
          <li>
            <strong>Rewritten plainly.</strong> AI rewrites the letter in your language and reading level. Every sentence must point to the part
            of the letter it came from.
          </li>
          <li>
            <strong>Checked twice.</strong> A separate AI checker grades each sentence against its source, and code double-checks every number
            and date. Deadlines are calculated by code, not guessed.
          </li>
        </ol>
      </section>
    </div>
  );
}
