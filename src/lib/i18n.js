// The app's own labels. For any language other than English, these are translated once by
// the server (task "ui") and cached in the browser, so results screens read fully in the
// reader's language.

export const EN = {
  badge_ok: 'Matches the letter',
  badge_warn: 'Check this one',
  badge_bad: 'Not in the letter',
  badge_pending: 'Checking…',
  from_letter: 'From the letter',
  no_source: 'No part of the letter was cited for this.',
  show_in_letter: 'Show it in the full letter',
  urgency_high: 'Act soon',
  urgency_medium: 'Action needed',
  urgency_low: 'For your information',
  checking_all: 'Checking each sentence against the letter…',
  checker_failed: 'The checker couldn’t run this time. Numbers and dates were still checked by code.',
  sum_plain: 'Plain version: {ok} of {total} match the letter',
  sum_todo: 'To-do list: {ok} of {total} match',
  sum_flag_hint: 'Items marked ! need a second look. Tap one to see why.',
  grade_original: 'Original',
  grade_plain: 'Plain',
  grade_note: 'Reading level can only be measured for English text.',
  grade_n: 'Grade {n}',
  grade_college: 'College',
  grade_college_grad: 'College graduate',
  tab_plain: 'Plain',
  tab_todo: 'To-do',
  tab_deadlines: 'Deadlines',
  tab_original: 'Letter',
  tap_hint: 'Tap any sentence to see where it came from.',
  read_aloud: 'Read aloud',
  stop: 'Stop',
  words_heading: 'Words from the letter',
  questions_heading: 'Questions you could ask them',
  mark_done: 'Mark as done',
  no_actions: 'This letter doesn’t ask you to do anything.',
  no_deadlines: 'No deadlines were found in this letter.',
  ask_receipt: 'This deadline counts from the day you got the letter. When did you get it?',
  ask_letter_date: 'This deadline counts from the date printed on the letter, but no date was found. What date is on it?',
  received_label: 'Day you got the letter',
  letter_date_label: 'Date on the letter',
  today: 'Today',
  math_heading: 'How this date was worked out',
  step_direct: 'The letter gives this date directly.',
  step_unreadable: 'The letter mentions a date, but it could not be read clearly.',
  step_unclear: 'The letter says to count from “{text}”. Fine Print can’t tell exactly when that is, so it did not guess.',
  step_start_letter: 'Start: {date} (the date on the letter)',
  step_start_receipt: 'Start: {date} (the day you got the letter)',
  step_add: 'Add {period}',
  step_weekends: 'Weekends are not counted.',
  step_holidays: 'Federal holidays not counted: {list}',
  step_result: '= {date}',
  unit_day: '1 day',
  unit_days: '{n} days',
  unit_business_day: '1 business day',
  unit_business_days: '{n} business days',
  unit_week: '1 week',
  unit_weeks: '{n} weeks',
  unit_month: '1 month',
  unit_months: '{n} months',
  unit_year: '1 year',
  unit_years: '{n} years',
  letter_date_unconfirmed: 'The letter’s date couldn’t be confirmed in the original. Check the date printed at the top.',
  ground_date_ok: 'This date appears in the original.',
  ground_date_bad: 'This date could not be found in the original. Double-check it.',
  ground_amount_ok: '“{n}” appears in the original.',
  ground_amount_bad: 'The time period could not be found in the original. Double-check it.',
  ground_none: 'No part of the letter was cited for this.',
  cal_apple: 'Apple / Outlook calendar',
  cal_google: 'Google Calendar',
  cal_details: 'Added by Fine Print. Check the original letter.',
  days_today: 'Today',
  days_tomorrow: 'Tomorrow',
  days_in: 'In {n} days',
  days_ago_one: '1 day ago',
  days_ago: '{n} days ago',
  passed_title: 'This date has passed',
  passed_body: 'Contact them now. You may still have options, but don’t wait.',
  passed_banner: 'A deadline in this letter has already passed. Contact the sender now.',
  original_hint: 'Underlined parts were used in the plain version. Tap any part to see what it became.',
  not_used: 'Not used in the plain version.',
  sent_heading: 'What was sent to the AI',
  sent_note: 'Only this text went to the server. Your photo and the details marked with a lock never left this device.',
  fix_text: 'Fix the text or change language',
  another: 'Explain another letter',
  note_no_source: 'No source was cited for this sentence.',
  note_code: 'Code check: {numbers} does not appear in the original.',
  note_no_result: 'The checker did not return a result for this one.',
  note_ok: 'Matches the original.',
  private_label: 'Hidden from the AI',
  working_title: 'Reading the fine print…',
  work_read: 'Read the letter on your device',
  work_hide: 'Hid private details',
  work_explain: 'Writing the plain version',
  work_verify: 'Checking every sentence against the letter',
  work_time: 'This usually takes 10–25 seconds.',
  confirm_new: 'Start over with a new letter? This result will be cleared.',
  new_letter: 'New letter',
  ask_title: 'Ask about this letter',
  ask_placeholder: 'Type a question about the letter',
  ask_send: 'Ask',
  ask_s1: 'What happens if I miss the deadline?',
  ask_s2: 'Who do I contact, and how?',
  ask_s3: 'Can I pay or do this in parts?',
  ask_thinking: 'Looking in the letter…',
  ask_based: 'From the letter',
  ask_not_said: 'The letter doesn’t say',
  ask_hint: 'Answers come only from this letter, and show where they came from.',
  ask_check_numbers: 'Code check: {numbers} does not appear in the letter. Double-check it.',
  save_letter: 'Save letter',
  saved: 'Saved on this phone',
  update_saved: 'Update saved letter',
  remind_all: 'Add all deadlines to my calendar',
  remind_note: 'Your phone will remind you 3 days and 1 day before each deadline.',
};

const PLACEHOLDER = /\{[a-z]+\}/g;

export function makeT(dict) {
  const safe = {  in_short: 'In short',
  next_step: 'Next step',
  next_deadline: 'Next deadline',
  ring_label: 'match',
};
  for (const [key, en] of Object.entries(EN)) {
    const tr = dict?.[key];
    // Use a translation only if it kept the same {placeholders}.
    const ok = typeof tr === 'string' && tr.trim() && [...(en.match(PLACEHOLDER) || [])].every((p) => tr.includes(p));
    safe[key] = ok ? tr : en;
  }
  return (key, vars = {}) => (safe[key] ?? key).replace(PLACEHOLDER, (p) => (p.slice(1, -1) in vars ? String(vars[p.slice(1, -1)]) : p));
}

export const tEnglish = makeT(EN);

export function periodText(t, amount, unit) {
  const one = amount === 1;
  const key = {
    days: one ? 'unit_day' : 'unit_days',
    business_days: one ? 'unit_business_day' : 'unit_business_days',
    weeks: one ? 'unit_week' : 'unit_weeks',
    months: one ? 'unit_month' : 'unit_months',
    years: one ? 'unit_year' : 'unit_years',
  }[unit];
  return key ? t(key, { n: amount }) : String(amount);
}

export function daysLeftText(t, n) {
  if (n == null) return '';
  if (n < -1) return t('days_ago', { n: -n });
  if (n === -1) return t('days_ago_one');
  if (n === 0) return t('days_today');
  if (n === 1) return t('days_tomorrow');
  return t('days_in', { n });
}
