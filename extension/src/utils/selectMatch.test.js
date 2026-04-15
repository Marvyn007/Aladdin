// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { matchHintToSelectOption, extractHintCandidates } from './selectMatch.js';

describe('matchHintToSelectOption', () => {
  it('matches short "Yes" option when AI hint is a long sentence starting with Yes', () => {
    const options = [
      { value: 'yes', text: 'Yes' },
      { value: 'no', text: 'No' },
    ];
    const hint = 'Yes, I am currently enrolled in a university and will return to the program upon completion of internship.';
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('yes');
  });

  it('matches short "No" option when AI hint is a long sentence starting with No', () => {
    const options = [
      { value: 'yes', text: 'Yes' },
      { value: 'no', text: 'No' },
    ];
    const hint = 'No, I do not require immigration sponsorship to work.';
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('no');
  });

  it('matches "Yes" when hint is just "Yes"', () => {
    const options = [
      { value: 'yes', text: 'Yes' },
      { value: 'no', text: 'No' },
    ];
    const result = matchHintToSelectOption('Yes', options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('yes');
  });

  it('matches graduation date "05/2026" against option "May 2026"', () => {
    const options = [
      { value: '12/2025', text: 'December 2025' },
      { value: '05/2026', text: 'May 2026' },
      { value: '12/2026', text: 'December 2026' },
      { value: '05/2027', text: 'May 2027' },
    ];
    const hint = 'May 2026';
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('05/2026');
  });

  it('matches graduation date when AI says "I expect to graduate in May 2026"', () => {
    const options = [
      { value: '12/2025', text: 'December 2025' },
      { value: '05/2026', text: 'May 2026' },
      { value: '12/2026', text: 'December 2026' },
    ];
    const hint = 'I expect to graduate in May 2026';
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('05/2026');
  });

  it('matches degree option when AI gives a long answer', () => {
    const options = [
      { value: 'ba', text: "Bachelor's" },
      { value: 'ma', text: "Master's" },
      { value: 'phd', text: 'PhD' },
      { value: 'other', text: 'Other' },
    ];
    const hint = "Bachelor of Computer Science, Minor in Business Administration at Southeast Missouri State University";
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('ba');
  });

  it('matches "I would be available to start immediately" to option containing "Immediately"', () => {
    const options = [
      { value: '1', text: 'Immediately' },
      { value: '2', text: 'In 2 weeks' },
      { value: '3', text: 'In 1 month' },
    ];
    const hint = 'I would be available to start full-time immediately after the completion of my internship.';
    const result = matchHintToSelectOption(hint, options);
    expect(result).not.toBeNull();
    expect(result.value).toBe('1');
  });
});

// ─── Polarity matching (long prose answers to binary yes/no options) ──────────

// ─── Gender / identity synonym matching ───────────────────────────────────────

describe('matchHintToSelectOption — gender synonyms (Male↔Man, Female↔Woman)', () => {
  const genderOpts = [
    { value: 'm', text: 'Man' },
    { value: 'f', text: 'Woman' },
    { value: 'nb', text: 'Non-binary' },
    { value: 'pnta', text: 'Prefer not to answer' },
  ];

  it('matches "Man" when profile hint is "Male"', () => {
    expect(matchHintToSelectOption('Male', genderOpts)?.value).toBe('m');
  });

  it('matches "Woman" when profile hint is "Female"', () => {
    expect(matchHintToSelectOption('Female', genderOpts)?.value).toBe('f');
  });

  it('does NOT match "Woman" when hint is "Male"', () => {
    const result = matchHintToSelectOption('Male', genderOpts);
    expect(result?.value).not.toBe('f');
  });

  it('does NOT match "Man" when hint is "Female"', () => {
    const result = matchHintToSelectOption('Female', genderOpts);
    expect(result?.value).not.toBe('m');
  });

  it('matches "Man" when profile stores "man" (lowercase)', () => {
    expect(matchHintToSelectOption('man', genderOpts)?.value).toBe('m');
  });

  it('matches "Woman" when profile stores "woman" (lowercase)', () => {
    expect(matchHintToSelectOption('woman', genderOpts)?.value).toBe('f');
  });
});

describe('matchHintToSelectOption — polarity fallback for binary yes/no', () => {
  const yesNo = [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ];

  it('matches Yes when AI writes an affirmative sentence without a leading "Yes"', () => {
    const hint = 'I plan to stay in Singapore for the entire duration of this internship.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('yes');
  });

  it('matches No when AI answer contains a clear negation phrase', () => {
    const hint = 'I currently do not require any immigration sponsorship to work in Singapore.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('no');
  });

  it('matches No for "will not require" phrasing', () => {
    const hint = 'I will not require visa sponsorship now or in the future.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('no');
  });

  it('matches Yes for "I am enrolled in a university" phrasing', () => {
    const hint = 'I am currently enrolled in a Bachelor of Science program at Southeast Missouri State University.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('yes');
  });

  it('matches Yes for "I have confirmed" phrasing', () => {
    const hint = 'I have confirmed plans to be available for the full internship in Singapore.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('yes');
  });

  it('does not apply polarity fallback when normal matching already picks a winner', () => {
    // "No, I do not..." already starts with No — should still return no via normal path
    const hint = 'No, I do not require sponsorship.';
    const result = matchHintToSelectOption(hint, yesNo);
    expect(result?.value).toBe('no');
  });

  it('polarity fallback works when Yes option has long text too', () => {
    const longOptions = [
      { value: '1', text: 'Yes, I confirm I will be in Singapore for the full duration' },
      { value: '0', text: 'No, I cannot confirm my presence for the full duration' },
    ];
    const hint = 'I have confirmed my presence in Singapore throughout the internship.';
    const result = matchHintToSelectOption(hint, longOptions);
    expect(result?.value).toBe('1');
  });
});

describe('extractHintCandidates', () => {
  it('extracts "Yes" from "Yes, I am enrolled..."', () => {
    const candidates = extractHintCandidates('Yes, I am enrolled in a university.');
    // Should contain at least the short "Yes" token
    const hasYes = candidates.some(c => c.toLowerCase() === 'yes');
    expect(hasYes).toBe(true);
  });
});
