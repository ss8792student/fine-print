// Flesch–Kincaid grade level (English only). Shows how much easier the plain version is.

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function gradeLevel(text) {
  const clean = String(text || '').replace(/\[[A-Z]+_\d+\]/g, 'item');
  const words = clean.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (words.length < 12) return null;
  const sentences = Math.max(1, (clean.match(/[.!?]+(\s|$)/g) || []).length);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
  return Math.max(1, Math.min(18, Math.round(grade * 10) / 10));
}

export function gradeLabel(g) {
  if (g == null) return '—';
  if (g >= 16) return 'College graduate';
  if (g >= 13) return 'College';
  return `Grade ${Math.round(g)}`;
}
