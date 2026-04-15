/**
 * Match free-form hints (profile values, LLM text, user paste) to <select> options.
 * Handles long sentences ("Yes, I am enrolled in MIT") and prefers exact / fuzzy option text.
 */

/** @typedef {{ value: string, text: string }} SelectOption */

const PREFIX_STRIP = [
  /^(yes|no)[,.\s]+/i,
  /^(yes,?\s*)?i\s*(?:'m|am)\s+(?:currently\s+)?(?:enrolled|studying|a student)\s+(?:at|in)\s+/i,
  /^(?:my\s+(?:university|school|college)\s+(?:is|was)\s+)/i,
  /^(?:i\s+(?:attend|attended)\s+)/i,
];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"]/g, '')
    .trim();
}

function tokenSet(s) {
  return new Set(
    norm(s)
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/** Digits only for dial-code comparison (handles +1, 001, etc.). */
function dialDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/^0+/, '') || '0';
}

/**
 * Extra score when hint looks like a phone country code and option shows +NN or same digits.
 */
function scoreDialCodeHint(hint, optionText) {
  const h = String(hint || '').trim();
  const o = String(optionText || '');
  let bonus = 0;
  const hd = dialDigits(h);
  if (hd.length >= 1 && hd.length <= 4) {
    const od = dialDigits(o);
    if (od.startsWith(hd) || hd === od || o.replace(/\s/g, '').includes(`+${hd}`)) bonus += 480;
    if (o.includes(`+${hd}`)) bonus += 120;
  }
  const iso = h.match(/\b([a-z]{2})\b/i);
  if (iso && iso[1]) {
    const code = iso[1].toUpperCase();
    if (new RegExp(`\\b${code}\\b`).test(o)) bonus += 420;
  }
  return bonus;
}

/**
 * Derive short search strings from a long answer.
 * @param {string} raw
 * @returns {string[]}
 */
export function extractHintCandidates(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];

  const out = new Set();
  out.add(s);

  let stripped = s;
  for (const re of PREFIX_STRIP) {
    stripped = stripped.replace(re, '').trim();
  }
  if (stripped.length >= 2) out.add(stripped);

  for (const part of s.split(/(?:\n|\.|;)\s+/)) {
    const p = part.trim();
    if (p.length >= 2) out.add(p);
  }

  const quoted = s.match(/"([^"]{2,120})"|'([^']{2,120})'/);
  if (quoted) out.add((quoted[1] || quoted[2]).trim());

  // Extract leading Yes/No/Maybe token so short dropdown options match.
  const leadingYesNo = s.match(/^(yes|no|maybe|true|false)\b/i);
  if (leadingYesNo) out.add(leadingYesNo[1]);

  // Extract key words that appear after common preambles:
  // "I would be available to start" → "immediately", "Bachelor's" from degree answers, etc.
  const afterPreamble = s.match(
    /\b(?:start|available|pursue|pursuing|enrolled|degree|graduated?)\s+(?:in\s+|as\s+|a\s+|an\s+|the\s+|full-time\s+)?(.{2,40})$/i
  );
  if (afterPreamble) {
    const tail = afterPreamble[1].replace(/[.,;!?]+$/, '').trim();
    if (tail.length >= 2) out.add(tail);
  }

  // Extract month-year patterns (e.g., "May 2026") for graduation date dropdowns.
  const monthYear = s.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i
  );
  if (monthYear) out.add(monthYear[0]);

  // ── Synonym expansion ──────────────────────────────────────────────────────
  // Profile stored values often differ from option labels. Expand in all
  // directions so a single-word hint always finds the closest option.
  const SYNONYMS = {
    // Gender
    male:             ['man', 'male', 'mr'],
    man:              ['male', 'man'],
    female:           ['woman', 'female', 'ms', 'mrs'],
    woman:            ['female', 'woman'],
    'non-binary':     ['non-binary', 'nonbinary', 'non binary', 'enby', 'genderqueer', 'gender non-conforming'],
    nonbinary:        ['non-binary', 'nonbinary', 'non binary'],
    'gender non-conforming': ['non-binary', 'nonbinary', 'gender non-conforming', 'genderqueer'],
    genderqueer:      ['non-binary', 'nonbinary', 'genderqueer'],
    // Race / ethnicity
    asian:            ['asian', 'asian american', 'asian / pacific islander', 'asian or pacific islander'],
    black:            ['black', 'african american', 'black or african american', 'black / african american'],
    'african american': ['black', 'african american', 'black or african american'],
    hispanic:         ['hispanic', 'latino', 'latina', 'hispanic or latino', 'hispanic / latino'],
    latino:           ['hispanic', 'latino', 'hispanic or latino'],
    white:            ['white', 'caucasian', 'white / caucasian'],
    caucasian:        ['white', 'caucasian'],
    'native american': ['native american', 'american indian', 'indigenous', 'american indian or alaska native'],
    // Veteran status
    veteran:          ['veteran', 'i am a veteran', 'protected veteran', 'i identify as a veteran'],
    'not a veteran':  ['not a veteran', 'i am not a protected veteran', 'i do not identify as a protected veteran'],
    // Disability
    'no disability':  ['no', 'no, i do not have a disability', 'i do not have a disability', 'not disabled'],
    'has disability': ['yes', 'yes, i have a disability', 'i have a disability'],
    // Yes / No normalisation
    yes:              ['yes', 'true', 'i am', 'i do', 'i have', 'i will'],
    no:               ['no', 'false', 'i am not', 'i do not', 'i will not', 'i have not'],
    // Country name synonyms
    'united states':  ['united states', 'united states of america', 'us', 'usa', 'u.s.', 'u.s.a.'],
    'usa':            ['united states', 'united states of america', 'us', 'usa'],
    'us':             ['united states', 'united states of america', 'us', 'usa'],
    'uk':             ['united kingdom', 'great britain', 'england', 'uk', 'u.k.'],
    'united kingdom': ['united kingdom', 'great britain', 'uk', 'u.k.'],
    'canada':         ['canada', 'ca'],
    'india':          ['india', 'in'],
    'australia':      ['australia', 'au'],
    'germany':        ['germany', 'deutschland', 'de'],
    'france':         ['france', 'fr'],
  };
  const sLower = s.trim().toLowerCase();
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (sLower === key || syns.includes(sLower)) {
      for (const syn of syns) out.add(syn);
      break;
    }
  }

  return [...out];
}

/**
 * Score how well `hint` matches option display text.
 */
function scorePair(hint, optionText) {
  const h = norm(hint);
  const o = norm(optionText);
  if (!h || !o) return 0;
  let base = 0;
  if (h === o) base = 1000;
  else if (h.includes(o)) base = 800 + Math.min(o.length, 80);
  else if (o.includes(h)) base = 700 + Math.min(h.length, 80);
  else {
    // Spaceless comparison: handles custom dropdowns that concatenate child text
    // without spaces (e.g. "UnitedStatesofAmerica" vs "united states of america").
    const hNoSpace = h.replace(/\s+/g, '');
    const oNoSpace = o.replace(/\s+/g, '');
    if (hNoSpace === oNoSpace) base = 950;
    else if (oNoSpace.includes(hNoSpace)) base = 750 + Math.min(hNoSpace.length, 80);
    else if (hNoSpace.includes(oNoSpace)) base = 700 + Math.min(oNoSpace.length, 80);
    else base = jaccard(hint, optionText) * 380;
  }

  return base + scoreDialCodeHint(hint, optionText);
}

/**
 * @param {string} hint
 * @param {SelectOption[]} options
 * @returns {SelectOption | null}
 */
export function matchHintToSelectOption(hint, options) {
  if (!hint || !options?.length) return null;

  const candidates = extractHintCandidates(hint);
  let best = null;
  let bestScore = 0;

  for (const opt of options) {
    const text = opt.text?.trim() || '';
    const val = opt.value != null ? String(opt.value).trim() : '';
    if (!text && !val) continue;
    for (const c of candidates) {
      const scText = text ? scorePair(c, text) : 0;
      const scVal = val ? scorePair(c, val) : 0;
      const sc = Math.max(scText, scVal);
      if (sc > bestScore) {
        bestScore = sc;
        best = opt;
      }
    }
  }

  // Dial-code / ISO matches can land in the 400–600 range without long text overlap.
  // Threshold of 150 (≈ 40% Jaccard) catches partial country name matches like
  // "United States" → "United States of America" (Jaccard ≈ 190) while staying
  // above random noise from unrelated options.
  if (bestScore >= 150) return best;

  // ── Polarity fallback: when the hint is a full sentence that semantically means
  // Yes or No but doesn't include the literal word, and the option set is binary
  // (only yes-like and no-like options), use negative-keyword detection to pick the
  // right side.  This handles AI answers like "I plan to stay in Singapore…" which
  // should resolve to "Yes" when normal scoring falls below the threshold.
  const polarityResult = tryPolarityFallback(hint, options);
  if (polarityResult) return polarityResult;

  return null;
}

/** Negative-polarity keywords that indicate a "No" answer. */
const NEGATIVE_RE =
  /\b(no\b|not\b|don'?t|won'?t|can'?t|cannot|never|without|no need|unnecessary|will not|do not|does not|have not|has not|didn'?t|wouldn'?t|shouldn'?t|unable|unauthorized|ineligible)\b/i;

/** Yes-like option text patterns. */
const YES_OPTION_RE = /^(yes|true|1|confirm|i will|i am|i have|i do)\b/i;
/** No-like option text patterns. */
const NO_OPTION_RE = /^(no|false|0|not applicable|i will not|i do not|i won'?t)\b/i;

/**
 * Polarity fallback for binary yes/no option sets.
 * Returns the best-matching option by determining whether the hint is
 * affirmative or negative, then mapping to the yes-side or no-side option.
 *
 * @param {string} hint
 * @param {SelectOption[]} options
 * @returns {SelectOption | null}
 */
function tryPolarityFallback(hint, options) {
  if (!hint || !options?.length) return null;

  // Only apply when the option set looks like a Yes/No pair (2–4 options, each
  // clearly "yes-like" or "no-like").
  const yesOpts = options.filter((o) => YES_OPTION_RE.test((o.text || '').trim()));
  const noOpts = options.filter((o) => NO_OPTION_RE.test((o.text || '').trim()));

  // Require at least one yes-like AND one no-like option, and no unclassified options
  // (to avoid applying polarity to arbitrary dropdowns like degree or date pickers).
  if (!yesOpts.length || !noOpts.length) return null;
  if (yesOpts.length + noOpts.length !== options.length) return null;

  const isNegative = NEGATIVE_RE.test(hint);
  // Pick the best option from the matching polarity bucket (first one is fine for
  // binary sets; for longer yes/no lists we pick based on residual jaccard).
  const bucket = isNegative ? noOpts : yesOpts;
  if (bucket.length === 1) return bucket[0];

  // Multiple options on same side — pick highest jaccard from the bucket.
  let pick = bucket[0];
  let topScore = 0;
  for (const opt of bucket) {
    const sc = jaccard(hint, opt.text || '') * 380;
    if (sc > topScore) { topScore = sc; pick = opt; }
  }
  return pick;
}

const FALLBACK_RES = [
  /\bother\b/i,
  /\bothers?\b/i,
  /none of (the )?above/i,
  /not (listed|applicable)/i,
  /does not apply/i,
  /n\/a\b/i,
  /prefer not to say/i,
  /decline to state/i,
  /not available/i,
];

/**
 * Pick "Other" / "None of the above" style option when nothing matched.
 * @param {SelectOption[]} options
 * @returns {SelectOption | null}
 */
export function pickFallbackSelectOption(options) {
  if (!options?.length) return null;

  for (const re of FALLBACK_RES) {
    const hit = options.find((o) => re.test(o.text || ''));
    if (hit) return hit;
  }

  const placeholder = options.find(
    (o) =>
      /^(select|choose|please\s+select|--)/i.test(norm(o.text)) && o.value === ''
  );
  // Prefer a real "Other" over first option
  const otherish = options.find(
    (o) => /^(other|others?|different|not\s+listed)\b/i.test(norm(o.text))
  );
  return otherish ?? null;
}
