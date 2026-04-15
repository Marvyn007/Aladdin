// src/lib/auto-apply/__tests__/match-field.test.ts
import { describe, it, expect } from 'vitest';
import { matchFieldToProfile } from '../match-field';
import type { ProfileContext } from '../match-field';

const emptyProfile: ProfileContext = {
  user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  onboardingAnswers: [],
  userContext: {},
  resumeSummary: '',
};

const profileWithCompany: ProfileContext = {
  ...emptyProfile,
  userContext: { aa_current_company: 'Acme Corp' },
};

describe('matchFieldToProfile — new employer-friendly defaults', () => {
  it('returns Yes for "us person" question', () => {
    expect(matchFieldToProfile({ label: 'Are you a US person?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "us national"', () => {
    expect(matchFieldToProfile({ label: 'US National?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "willing to work overtime"', () => {
    expect(matchFieldToProfile({ label: 'Willing to work overtime?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "able to commute"', () => {
    expect(matchFieldToProfile({ label: 'Are you able to commute to our office?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "non-compete agreement"', () => {
    expect(matchFieldToProfile({ label: 'Are you willing to sign a non-compete agreement?' }, emptyProfile)).toBe('Yes');
  });

  it('returns No for "felony conviction"', () => {
    expect(matchFieldToProfile({ label: 'Have you been convicted of a felony?' }, emptyProfile)).toBe('No');
  });

  it('returns No for "criminal record"', () => {
    expect(matchFieldToProfile({ label: 'Do you have a criminal record?' }, emptyProfile)).toBe('No');
  });

  it('returns Yes for "open to contract work"', () => {
    expect(matchFieldToProfile({ label: 'Are you open to contract work?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "currently employed" when profile has current company', () => {
    expect(matchFieldToProfile({ label: 'Are you currently employed?' }, profileWithCompany)).toBe('Yes');
  });

  it('returns null for "currently employed" when no current company in profile', () => {
    expect(matchFieldToProfile({ label: 'Are you currently employed?' }, emptyProfile)).toBeNull();
  });

  // Existing patterns — regression guard
  it('returns Yes for "willing to relocate" (existing)', () => {
    expect(matchFieldToProfile({ label: 'Are you willing to relocate?' }, emptyProfile)).toBe('Yes');
  });

  it('returns No for "require visa sponsorship" (existing)', () => {
    expect(matchFieldToProfile({ label: 'Do you require visa sponsorship?' }, emptyProfile)).toBe('No');
  });
});
