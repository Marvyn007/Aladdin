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

// ─── Workday / ATS referral & employment ─────────────────────────────────────

describe('matchFieldToProfile — Workday referral & prior employment', () => {
  const base = {
    user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
    onboardingAnswers: [],
    userContext: {},
  };

  it('selects Other for "How Did You Hear About Us?"', () => {
    expect(matchFieldToProfile(field('How Did You Hear About Us?'), base)).toBe('Other');
    expect(matchFieldToProfile(field('How did you hear about this job?'), base)).toBe('Other');
  });

  it('fills referral follow-up free-text with "aladdin" (literal brand answer)', () => {
    expect(
      matchFieldToProfile(
        field('If Other, please specify how you heard about this opportunity'),
        base
      )
    ).toBe('aladdin');
  });

  it('returns No for "previously been employed by <company>"', () => {
    expect(
      matchFieldToProfile(
        field("Have you previously been employed by Owen's & Minor? CURRENT TEAMMATES: Please apply via internal Workday."),
        base
      )
    ).toBe('No');
  });

  it('maps Phone Device Type from Apply Pilot userContext', () => {
    const p = {
      ...base,
      userContext: { aa_phone_device_type: 'Mobile' },
    };
    expect(matchFieldToProfile(field('Phone Device Type'), p)).toBe('Mobile');
    expect(matchFieldToProfile(field('Phone device type (Required)'), p)).toBe('Mobile');
  });
});
