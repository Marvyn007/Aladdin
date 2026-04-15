import { describe, it, expect } from 'vitest';
import { matchFieldToProfile, type FieldMeta, type ProfileContext } from '@/lib/auto-apply/match-field';

function makeProfile(overrides: Partial<ProfileContext> = {}): ProfileContext {
  return {
    user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    onboardingAnswers: [
      { questionKey: 'aa_phone',            answerText: '555-1234' },
      { questionKey: 'aa_linkedin_url',     answerText: 'https://linkedin.com/in/janedoe' },
      { questionKey: 'aa_city',             answerText: 'San Francisco' },
      { questionKey: 'aa_state',            answerText: 'CA' },
      { questionKey: 'aa_zip',              answerText: '94105' },
      { questionKey: 'aa_country',          answerText: 'United States' },
      { questionKey: 'aa_current_title',    answerText: 'Software Engineer' },
      { questionKey: 'aa_years_experience', answerText: '5' },
    ],
    userContext: {},
    resumeSummary: 'Experienced software engineer with 5 years in React and Node.js.',
    ...overrides,
  };
}

function field(label: string): FieldMeta {
  return { label, placeholder: '', name: '', ariaLabel: '' };
}

describe('matchFieldToProfile', () => {
  it('returns first name from user object', () => {
    expect(matchFieldToProfile(field('First Name'), makeProfile())).toBe('Jane');
  });

  it('returns last name from user object', () => {
    expect(matchFieldToProfile(field('Last Name'), makeProfile())).toBe('Doe');
  });

  it('returns email from user object', () => {
    expect(matchFieldToProfile(field('Email Address'), makeProfile())).toBe('jane@example.com');
  });

  it('returns phone from onboarding answers', () => {
    expect(matchFieldToProfile(field('Phone Number'), makeProfile())).toBe('555-1234');
  });

  it('returns LinkedIn URL', () => {
    expect(matchFieldToProfile(field('LinkedIn URL'), makeProfile())).toBe('https://linkedin.com/in/janedoe');
  });

  it('returns city', () => {
    expect(matchFieldToProfile(field('City'), makeProfile())).toBe('San Francisco');
  });

  it('returns state', () => {
    expect(matchFieldToProfile(field('State'), makeProfile())).toBe('CA');
  });

  it('returns null for unknown field', () => {
    expect(matchFieldToProfile(field('Favorite Color'), makeProfile())).toBeNull();
  });

  it('returns "Yes" for work authorization field', () => {
    expect(matchFieldToProfile(field('Are you authorized to work in the US?'), makeProfile())).toBe('Yes');
  });

  it('returns "No" for sponsorship field', () => {
    expect(matchFieldToProfile(field('Do you require visa sponsorship?'), makeProfile())).toBe('No');
  });

  it('uses userContext aa_ value over onboardingAnswers', () => {
    const profile = makeProfile({ userContext: { aa_phone: '999-9999' } });
    expect(matchFieldToProfile(field('Mobile Phone'), profile)).toBe('999-9999');
  });

  it('returns current title', () => {
    expect(matchFieldToProfile(field('Current Job Title'), makeProfile())).toBe('Software Engineer');
  });

  it('returns years of experience', () => {
    expect(matchFieldToProfile(field('Years of Experience'), makeProfile())).toBe('5');
  });
});
