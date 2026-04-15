// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { matchFieldToProfile } from './fieldMatcher.js';

// Minimal profile — only the keys that matter for each test
const profile = {
  user: { firstName: 'Marvin', lastName: 'Chaudhary', email: 'iammarvin7@gmail.com' },
  onboardingAnswers: [],
  userContext: {},
};

function field(label) {
  return { label, placeholder: '', name: '', ariaLabel: '' };
}

// ─── "Get hired" Yes defaults ─────────────────────────────────────────────────

describe('matchFieldToProfile — get-hired Yes defaults', () => {
  it('returns Yes for "Are you a national of the country where you are applying to work?"', () => {
    expect(matchFieldToProfile(field('Are you a national of the country where you are applying to work?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Do you have the right to work in this country?"', () => {
    expect(matchFieldToProfile(field('Do you have the right to work in this country?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Are you eligible to work full-time?"', () => {
    expect(matchFieldToProfile(field('Are you eligible to work full-time?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Are you willing to accommodate our shift schedule?"', () => {
    expect(matchFieldToProfile(field('Are you willing to accommodate our shift schedule?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Are you willing to undergo a background check?"', () => {
    expect(matchFieldToProfile(field('Are you willing to undergo a background check?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Are you able to work on-site / in-office?"', () => {
    expect(matchFieldToProfile(field('Are you able to work on-site / in-office?'), profile)).toBe('Yes');
  });

  it('returns Yes for "Can you work full time?"', () => {
    expect(matchFieldToProfile(field('Can you work full time?'), profile)).toBe('Yes');
  });

  it('still returns No for sponsorship questions (existing behaviour unchanged)', () => {
    expect(matchFieldToProfile(field('Do you require sponsorship to work in this country?'), profile)).toBe('No');
  });

  it('still returns Yes for work-authorization questions (existing behaviour unchanged)', () => {
    expect(matchFieldToProfile(field('Are you legally authorized to work in the United States?'), profile)).toBe('Yes');
  });
});
