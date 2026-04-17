import { describe, it, expect } from 'vitest';
import { TIER_LIMITS, SOFT_CAP, UNLIMITED, STRIPE_PRICE_TO_PLAN } from './tier-config';

describe('TIER_LIMITS', () => {
  it('LITE blocks all features at 0', () => {
    expect(TIER_LIMITS.LITE.resumesGenerated).toBe(0);
    expect(TIER_LIMITS.LITE.coverLettersGenerated).toBe(0);
    expect(TIER_LIMITS.LITE.emailsRetrieved).toBe(0);
    expect(TIER_LIMITS.LITE.linkedinRetrieved).toBe(0);
  });

  it('COPILOT has correct hard limits', () => {
    expect(TIER_LIMITS.COPILOT.resumesGenerated).toBe(15);
    expect(TIER_LIMITS.COPILOT.coverLettersGenerated).toBe(30);
    expect(TIER_LIMITS.COPILOT.emailsRetrieved).toBe(30);
    expect(TIER_LIMITS.COPILOT.linkedinRetrieved).toBe(60);
  });

  it('CAPTAIN has correct limits with UNLIMITED for CL and linkedin', () => {
    expect(TIER_LIMITS.CAPTAIN.resumesGenerated).toBe(60);
    expect(TIER_LIMITS.CAPTAIN.coverLettersGenerated).toBe(UNLIMITED);
    expect(TIER_LIMITS.CAPTAIN.emailsRetrieved).toBe(150);
    expect(TIER_LIMITS.CAPTAIN.linkedinRetrieved).toBe(UNLIMITED);
  });

  it('SOFT_CAP is 500', () => {
    expect(SOFT_CAP).toBe(500);
  });
});
