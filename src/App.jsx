import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Home from './components/Home.jsx';
import Review from './components/Review.jsx';
import Working from './components/Working.jsx';
import Results from './components/Results.jsx';
import { prepare, sanitizeResult, addMissingSources, buildClaims, localChecks, finalBadges } from './lib/analyze.js';
import { callServer, cacheGet, cacheKey, cacheSet, loadUiStrings, saveSession, loadSession, MOJIBAKE } from './lib/client.js';
import { makeT, tEnglish } from './lib/i18n.js';
import { readImage } from './lib/ocr.js';
import { listSaved, saveLetter, deleteSaved } from './lib/saved.js';
import { readPdf } from './lib/pdftext.js';

const saved = typeof window !== 'undefined' ? loadSession() : null;

export default function App() {
  const initialScreen = saved?.screen === 'results' && saved?.analysis ? 'results' : saved?.screen === 'review' || saved?.screen === 'working' ? 'review' : 'home';
  const [screen, setScreen] = useState(initialScreen);
  const [rawText, setRawText] = useState(saved?.rawText || '');
  const [sourceNote, setSourceNote] = useState(saved?.sourceNote || '');
  const [language, setLanguage] = useState(saved?.language || 'English');
  const [level, setLevel] = useState(saved?.level || 'clear');
  const [extraHidden, setExtraHidden] = useState(saved?.extraHidden || []);
  const [allowed, setAllowed] = useState(saved?.allowed || []);
  const [images, setImages] = useState([]); // photo previews (this visit only)
  const [reading, setReading] = useState(null);
  const [steps, setSteps] = useState({});
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(saved?.analysis || null);
  const runId = useRef(0);
  const [savedLetters, setSavedLetters] = useState(() => listSaved());

  const prepared = useMemo(() => prepare(rawText, { extra: extraHidden, allow: allowed }), [rawText, extraHidden, allowed]);
  const t = useMemo(() => (analysis?.ui ? makeT(analysis.ui) : tEnglish), [analysis]);

  // ---- browser history: Back moves between screens instead of leaving the app ----
  const go = useCallback((next, { replace = false } = {}) => {
    setScreen(next);
    try {
      if (replace) window.history.replaceState({ screen: next }, '');
      else window.history.pushState({ screen: next }, '');
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    try {
      window.history.replaceState({ screen: initialScreen }, '');
    } catch {
      /* ignore */
    }
    const onPop = (e) => {
      const target = e.state?.screen || 'home';
      runId.current++; // cancel any analysis in flight
      setScreen((current) => {
        if (target === 'working') return current === 'results' ? 'review' : 'review';
        return target;
      });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // If we land on results without a result (e.g. after Back/Forward edge cases), fall back.
  useEffect(() => {
    if (screen === 'results' && !analysis) setScreen(rawText ? 'review' : 'home');
    if (screen === 'review' && !rawText) setScreen('home');
  }, [screen, analysis, rawText]);

  // ---- keep the current letter if the page is refreshed ----
  useEffect(() => {
    saveSession({ screen, rawText, sourceNote, language, level, extraHidden, allowed, analysis });
  }, [screen, rawText, sourceNote, language, level, extraHidden, allowed, analysis]);

  const goReview = (text, note, imgs = []) => {
    setRawText(text);
    setSourceNote(note);
    setExtraHidden([]);
    setAllowed([]);
    setImages((old) => {
      old.forEach((u) => URL.revokeObjectURL(u));
      return imgs;
    });
    setError('');
    go('review');
  };

  const handleFiles = useCallback(async (files) => {
    const list = [...files];
    if (!list.length) return;
    setError('');
    const previews = [];
    try {
      const texts = [];
      let note = '';
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const label = list.length > 1 ? `Reading page ${i + 1} of ${list.length} on your device` : 'Reading the letter on your device';
        setReading({ label, progress: 0 });
        const onProgress = (p) => setReading({ label, progress: (i + p) / list.length });
        if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
          const { text, truncated } = await readPdf(file, onProgress);
          texts.push(text);
          if (truncated) note = 'Only the first 5 pages of the PDF were read. ';
        } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name || '')) {
          const { text } = await readImage(file, onProgress);
          texts.push(text);
          previews.push(URL.createObjectURL(file));
        } else {
          throw new Error('That file type isn’t supported. Use a photo (JPG or PNG) or a PDF.');
        }
      }
      const text = texts.join('\n\n').trim();
      setReading(null);
      if (text.replace(/\s/g, '').length < 20) {
        previews.forEach((u) => URL.revokeObjectURL(u));
        setError('No readable text was found. Retake the photo in good light, flat and filling the frame, or paste the text instead.');
        return;
      }
      goReview(text, `${note}Read on your device from ${list.length > 1 ? `${list.length} files` : 'your file'}. Compare it with your photo and fix any misread words.`, previews);
    } catch (err) {
      previews.forEach((u) => URL.revokeObjectURL(u));
      setReading(null);
      setError(err.message || 'Something went wrong while reading the file.');
    }
  }, []);

  const runAnalysis = async () => {
    const { segments, items } = prepared;
    if (!segments.length) return;
    const myRun = ++runId.current;
    const stillMine = () => runId.current === myRun;
    go('working');
    setError('');
    setSteps({ read: 'done', hide: 'done', explain: 'active' });

    const sendSegments = segments.map(({ id, text }) => ({ id, text }));
    const sent = { task: 'explain', language, level, segments: sendSegments };
    const segById = new Map(segments.map((s) => [s.id, s]));
    const uiPromise = loadUiStrings(language).catch(() => null);
    try {
      const key = await cacheKey({ segments: sendSegments, language, level, v: 2 });
      const cached = cacheGet(key);

      let result;
      if (cached?.result) result = cached.result;
      else {
        const data = await callServer(sent);
        result = sanitizeResult(data.result, segments);
      }
      if (!stillMine()) return;
      result = addMissingSources(result, segments);
      if (!result.is_document) {
        go('review', { replace: true });
        setError('This doesn’t look like a letter or document. Check the text below, or try a clearer photo.');
        return;
      }

      const ui = await uiPromise;
      if (!stillMine()) return;
      const local = localChecks(result, segById);
      setSteps({ read: 'done', hide: 'done', explain: 'done', verify: 'active' });
      const base = { prepared: { segments, items }, result, local, verdicts: null, sent, language, level, ui, qa: [] };
      setAnalysis(base);
      go('results', { replace: true });

      // Second pass runs while the person is already reading the results.
      let verdicts = cached?.verdicts;
      let verifyError = '';
      if (!verdicts) {
        try {
          const claims = buildClaims(result, segById);
          const data = await callServer({ task: 'verify', language, claims });
          verdicts = data.result?.verdicts || [];
        } catch (err) {
          verifyError = err.message;
          verdicts = [];
        }
      }
      if (!stillMine()) return;
      const clean = !MOJIBAKE.test(JSON.stringify(result)) && !MOJIBAKE.test(JSON.stringify(verdicts));
      if (!verifyError && clean) cacheSet(key, { result, verdicts });
      setAnalysis((cur) => ({ ...(cur || base), verdicts, verifyError, badges: finalBadges(result, local, verdicts) }));
    } catch (err) {
      if (!stillMine()) return;
      go('review', { replace: true });
      setError(err.message || 'Something went wrong. Try again.');
    }
  };

  // ---- saved letters (on this device only) ----
  const saveCurrent = (deadlineDates) => {
    if (!analysis) return false;
    const entry = saveLetter({
      id: analysis.savedId,
      title: analysis.result.document_type || 'Letter',
      sender: analysis.result.sender || '',
      language: analysis.language,
      deadlines: deadlineDates,
      rawText,
      analysis: { ...analysis },
    });
    if (!entry) return false;
    setAnalysis((a) => ({ ...a, savedId: entry.id }));
    setSavedLetters(listSaved());
    return true;
  };

  const openSaved = (id) => {
    const entry = listSaved().find((e) => e.id === id);
    if (!entry) return;
    runId.current++;
    setRawText(entry.rawText || '');
    setLanguage(entry.analysis.language || 'English');
    setLevel(entry.analysis.level || 'clear');
    setExtraHidden([]);
    setAllowed([]);
    setAnalysis({ ...entry.analysis, savedId: entry.id });
    go('results');
  };

  const removeSaved = (id) => {
    if (!window.confirm('Delete this saved letter from this phone?')) return;
    setSavedLetters(deleteSaved(id));
    if (analysis?.savedId === id) setAnalysis((a) => ({ ...a, savedId: undefined }));
  };

  const updateQa = (qa) =>
    setAnalysis((a) => {
      if (!a) return a;
      const next = { ...a, qa };
      // Keep a saved letter's questions up to date too.
      if (a.savedId && qa.every((x) => x.status !== 'pending')) {
        const entry = listSaved().find((e) => e.id === a.savedId);
        if (entry) {
          saveLetter({ ...entry, analysis: next });
          setSavedLetters(listSaved());
        }
      }
      return next;
    });

  const startOver = () => {
    if ((screen === 'results' || screen === 'review') && rawText && !(screen === 'results' && analysis?.savedId) && !window.confirm(t('confirm_new'))) return;
    runId.current++;
    setAnalysis(null);
    setRawText('');
    setExtraHidden([]);
    setAllowed([]);
    setImages((old) => {
      old.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
    setError('');
    go('home');
  };

  return (
    <div className="app">
      <header className="masthead">
        <button className="wordmark" onClick={startOver} aria-label="Fine Print — start over">
          <span className="wordmark-mark" aria-hidden="true" />
          Fine Print
        </button>
        {screen !== 'home' && (
          <button className="link-button" onClick={startOver}>
            {screen === 'results' ? t('new_letter') : 'New letter'}
          </button>
        )}
      </header>

      <main>
        {screen === 'home' && (
          <Home
            onFiles={handleFiles}
            onPaste={(text) => goReview(text, '')}
            onSample={(s) => goReview(s.text, `Sample letter: ${s.title}. Everything in it is made up.`)}
            reading={reading}
            error={error}
            saved={savedLetters}
            onOpenSaved={openSaved}
            onDeleteSaved={removeSaved}
          />
        )}
        {screen === 'review' && (
          <Review
            rawText={rawText}
            setRawText={setRawText}
            note={sourceNote}
            images={images}
            prepared={prepared}
            extraHidden={extraHidden}
            setExtraHidden={setExtraHidden}
            allowed={allowed}
            setAllowed={setAllowed}
            language={language}
            setLanguage={setLanguage}
            level={level}
            setLevel={setLevel}
            error={error}
            onBack={startOver}
            onExplain={runAnalysis}
          />
        )}
        {screen === 'working' && <Working steps={steps} t={tEnglish} />}
        {screen === 'results' && analysis && (
          <Results analysis={analysis} t={t} onEdit={() => go('review')} onStartOver={startOver} onSave={saveCurrent} onQaChange={updateQa} />
        )}
      </main>

      <footer className="site-footer">
        <p>Fine Print explains letters; it is not legal, medical or financial advice. Always confirm important details with whoever sent the letter.</p>
      </footer>
    </div>
  );
}
