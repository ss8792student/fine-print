# Fine Print

**Official letters, in words you can act on.**

Fine Print turns a confusing official letter (e.g., a utility shutoff notice, a school attendance letter, a lease renewal, an insurance denial, etc.) into plain language in the reader's own language and reading level. It pulls out a to-do list and the real deadlines, and it shows exactly where every sentence came from.

Other apps tell you what a letter says. **Fine Print shows you why you can trust it.**

## What makes it different

1. **Every sentence can be checked.** Each plain-language sentence cites the exact part of the letter it came from. Tap it and the original wording is highlighted. A second, independent AI checker grades each sentence against its source, and plain code double-checks that every number, amount and date really appears in the original.
2. **Deadlines are calculated by code, not guessed by AI.** The AI only reports *what the letter says* ("within 30 days of the date of this notice"). The app does the date math and shows its work. If a deadline counts from when you received the letter, it asks you instead of guessing.
3. **Private by design.** Photos are read on the phone. Names, street addresses, Social Security, account, case and card numbers, phone numbers, emails and birth dates are replaced with placeholders *before* anything is sent, and put back only on your screen. The app shows exactly what was sent.
4. **Free and multilingual.** 31 languages in the menu plus any language typed in, three reading levels, read-aloud, and the whole results screen (labels included) in the reader's language, with full right-to-left layout for Arabic, Urdu, Farsi and Pashto.

5. **Ask about the letter.** People can ask questions like "What happens if I miss the deadline?" Answers come only from the letter, cite the passages they used, and get the same code check for numbers. Any private number typed into a question is hidden before it's sent.
6. **Saved letters and reminders.** Letters can be saved on the phone (never uploaded). The home screen shows what's coming up, and one tap adds every deadline to the phone's calendar with reminders 3 days and 1 day before.

## How it works

```
Photo / PDF / pasted text
   ↓  on the device
1. Read the text (Tesseract.js for photos, PDF.js for PDFs)
2. Hide private details (regex + Luhn check)       → [ACCOUNT_1], [PHONE_1] …
3. Split into numbered pieces                       → [S1] [S2] [S3] …
   ↓  person reviews and edits the text, then taps "Explain"
4. AI call #1 (Claude Sonnet): plain sentences that cite [S#], to-do list, deadlines — as strict JSON
5. AI call #2 (Claude Haiku, separate checker): is each sentence supported by the pieces it cites?
6. Code checks: every number/date in a sentence must appear in its cited pieces
7. Code calculates deadlines and the reading level before and after
```

## Tech

- React + Vite (JavaScript), one stylesheet
- One serverless function (`api/claude.js`) on Vercel keeps the API key secret
- Claude API with JSON structured outputs
- Tesseract.js (on-device text recognition), PDF.js
- No database; results are cached only in the browser

| File | What it does |
|---|---|
| `api/claude.js` | The only server code: explain + verify calls, input limits, rate limit |
| `src/lib/redact.js` | Finds and hides private details on the device |
| `src/lib/segment.js` | Splits the letter into numbered pieces |
| `src/lib/checks.js` | Rule-based number and date checks |
| `src/lib/deadlines.js` | Deadline math (calendar days, business days, months) |
| `src/lib/calendar.js` | Add-to-calendar (.ics and Google Calendar) |
| `src/lib/readability.js` | Flesch–Kincaid grade level |
| `src/lib/ocr.js`, `src/lib/pdftext.js` | On-device reading of photos and PDFs |
| `src/components/` | The screens |
| `tests/lib.test.js` | Unit tests for the on-device logic (`npm test`) |
| `samples/` | Printable made-up sample letters for demos |

## Run it locally

```bash
npm install
cp .env.example .env.local   # then put your Anthropic API key in .env.local
npm run dev
```

## Deploy

1. Push this folder to a GitHub repository.
2. In Vercel, import the repository (framework preset: Vite).
3. Add the environment variable `ANTHROPIC_API_KEY`, then deploy.

## Limitations

- Names are found from patterns (the recipient block, "Dear ___", labelled fields like "Member:"), so unusual layouts can miss one. People can select any text and tap **Hide selected text**.
- The text reader works best on flat, well-lit photos. The review screen lets you fix misread words before sending.
- Business-day deadlines skip weekends and US federal holidays, but not state or local holidays.
- Fine Print explains letters. It is not legal, medical or financial advice.

## AI use disclosure

- **AI within the app:** Fine Print uses Anthropic's Claude API to power its features. Claude Sonnet generates plain-language explanations, answers questions about letters, and translates interface labels. A separate model, Claude Haiku, checks whether the generated explanations are supported by the original letter. JavaScript code performs additional checks on numbers, dates, and source references.
- **AI used during development:** I wrote the majority of the application's code in an external IDE. I used Claude as a coding assistant to improve readability of code and documentation, identify bugs, and suggest fixes. I reviewed and incorporated changes before pushing major updates to GitHub.

## Technical challenges

- **AI making up dates.** Language models are unreliable at date arithmetic and sometimes state a deadline that isn't in the letter. Fix: the AI only reports the deadline *as written* (amount, unit, starting point), and code computes the date and checks that the numbers appear in the cited text.
- **An AI checking itself isn't enough.** A model grading its own output tends to approve it. Fix: two layers — a separate model sees only one sentence and its cited source at a time, plus deterministic code checks for numbers and dates, which catch the errors AI judges most often miss.
- **Privacy vs. usefulness.** Hiding a phone number means the AI can't tell you to call it. Fix: placeholders like `[PHONE_1]` keep the meaning, and the app restores the real value on the device after the response comes back.
- **Messy phone photos.** Fix: resize and boost contrast before text recognition, and let the person correct the text before anything is sent.
