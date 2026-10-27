// Browser helpers: calling the server, caching results, languages and read-aloud.
import { EN } from './i18n.js';
import { ES } from './i18n-es.js';

const BUILT_IN_UI = { spanish: ES };

export const LANGUAGES = [
  { name: 'English', code: 'en-US' },
  { name: 'Spanish', code: 'es-US', native: 'Español' },
  { name: 'Vietnamese', code: 'vi-VN', native: 'Tiếng Việt' },
  { name: 'Simplified Chinese', code: 'zh-CN', native: '简体中文' },
  { name: 'Traditional Chinese', code: 'zh-TW', native: '繁體中文' },
  { name: 'Arabic', code: 'ar', native: 'العربية', rtl: true },
  { name: 'Hindi', code: 'hi-IN', native: 'हिन्दी' },
  { name: 'Urdu', code: 'ur-PK', native: 'اردو', rtl: true },
  { name: 'Telugu', code: 'te-IN', native: 'తెలుగు' },
  { name: 'Tamil', code: 'ta-IN', native: 'தமிழ்' },
  { name: 'Bengali', code: 'bn-IN', native: 'বাংলা' },
  { name: 'Gujarati', code: 'gu-IN', native: 'ગુજરાતી' },
  { name: 'Punjabi', code: 'pa-IN', native: 'ਪੰਜਾਬੀ' },
  { name: 'Nepali', code: 'ne-NP', native: 'नेपाली' },
  { name: 'Korean', code: 'ko-KR', native: '한국어' },
  { name: 'Japanese', code: 'ja-JP', native: '日本語' },
  { name: 'Tagalog', code: 'fil-PH', native: 'Tagalog' },
  { name: 'Burmese', code: 'my-MM', native: 'မြန်မာ' },
  { name: 'French', code: 'fr-FR', native: 'Français' },
  { name: 'Haitian Creole', code: 'ht-HT', native: 'Kreyòl ayisyen' },
  { name: 'Portuguese', code: 'pt-BR', native: 'Português' },
  { name: 'German', code: 'de-DE', native: 'Deutsch' },
  { name: 'Italian', code: 'it-IT', native: 'Italiano' },
  { name: 'Polish', code: 'pl-PL', native: 'Polski' },
  { name: 'Russian', code: 'ru-RU', native: 'Русский' },
  { name: 'Ukrainian', code: 'uk-UA', native: 'Українська' },
  { name: 'Persian (Farsi)', code: 'fa-IR', native: 'فارسی', rtl: true },
  { name: 'Pashto', code: 'ps-AF', native: 'پښتو', rtl: true },
  { name: 'Somali', code: 'so-SO', native: 'Soomaali' },
  { name: 'Swahili', code: 'sw-KE', native: 'Kiswahili' },
  { name: 'Amharic', code: 'am-ET', native: 'አማርኛ' },
];
export const languageLabel = (l) => (l.native && l.native !== l.name ? `${l.native} (${l.name})` : l.name);
const RTL_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
// Any language works: names not in the list are passed to the AI as typed.
export function languageInfo(name, sampleText = '') {
  const known = LANGUAGES.find((l) => l.name.toLowerCase() === String(name).toLowerCase());
  if (known) return known;
  return { name, code: '', rtl: RTL_SCRIPT.test(sampleText), custom: true };
}

export const LEVELS = [
  { id: 'simple', label: 'Simplest', hint: 'Very short sentences' },
  { id: 'clear', label: 'Clear', hint: 'Everyday words' },
  { id: 'detailed', label: 'Detailed', hint: 'Keeps more specifics' },
];

export async function callServer(payload, { timeoutMs = 75000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await resp.json();
    } catch {
      /* non-JSON error page */
    }
    if (!resp.ok) throw new Error(data?.error || `The server returned an error (${resp.status}).`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The request took too long. Check your connection and try again.');
    if (err instanceof TypeError) throw new Error('Could not reach the server. Check your internet connection.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---- cache: re-running the same letter with the same settings costs nothing ----
const CACHE_KEY = 'fineprint-cache-v2';

// Broken accents like "dÃ­as" — never cache a result that has them.
export const MOJIBAKE = /[ÃÂĂâ][\u0080-\u024F\u2018-\u203A€]/;

export async function cacheKey(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  try {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381;
    for (const b of bytes) h = ((h << 5) + h + b) | 0;
    return String(h >>> 0);
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function cacheGet(key) {
  return readCache().find((e) => e.key === key)?.value ?? null;
}

export function cacheSet(key, value) {
  try {
    const list = readCache().filter((e) => e.key !== key);
    list.unshift({ key, value });
    localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage full or blocked — fine, just no cache */
  }
}

// ---- read aloud ----
export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, langCode, onEnd) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (langCode) {
    u.lang = langCode;
    const base = langCode.split('-')[0].toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang?.toLowerCase() === langCode.toLowerCase()) || voices.find((v) => v.lang?.toLowerCase().startsWith(base));
    if (voice) u.voice = voice;
  }
  u.rate = 0.95;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

// ---- the app's own labels in the reader's language (fetched once per language) ----
const UI_KEY = 'fineprint-ui-v3-';

export async function loadUiStrings(language) {
  if (!language || /^english$/i.test(language)) return null;
  if (BUILT_IN_UI[language.toLowerCase()]) return BUILT_IN_UI[language.toLowerCase()];
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY + language) || 'null');
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const data = await callServer({ task: 'ui', language, strings: EN }, { timeoutMs: 45000 });
  const dict = data.result || null;
  if (dict && !MOJIBAKE.test(JSON.stringify(dict))) {
    try {
      localStorage.setItem(UI_KEY + language, JSON.stringify(dict));
    } catch {
      /* ignore */
    }
  }
  return dict;
}

// ---- keep the current letter across refreshes (this tab only) ----
const SESSION_KEY = 'fineprint-session-v1';
export function saveSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
