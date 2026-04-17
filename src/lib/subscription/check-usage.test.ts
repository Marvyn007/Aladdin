import { describe, it, expect } from 'vitest';
import { isAtLimit, isAtSoftCap } from './check-usage';
import { TIER_LIMITS, UNLIMITED, SOFT_CAP } from './tier-config';

describe('isAtLimit', () => {
  it('returns true when current equals limit', () => {
    expect(isAtLimit(15, 15)).toBe(true);
  });

  it('returns true when current exceeds limit', () => {
    expect(isAtLimit(16, 15)).toBe(true);
  });

  it('returns false when current is under limit', () => {
    expect(isAtLimit(14, 15)).toBe(false);
  });

  it('returns true for LITE plan (limit 0, current 0)', () => {
    expect(isAtLimit(0, TIER_LIMITS.LITE.resumesGenerated)).toBe(true);
  });
});

describe('isAtSoftCap', () => {
  it('returns true when limit is UNLIMITED and current >= SOFT_CAP', () => {
    expect(isAtSoftCap(500, UNLIMITED)).toBe(true);
    expect(isAtSoftCap(600, UNLIMITED)).toBe(true);
  });

  it('returns false when limit is UNLIMITED and current < SOFT_CAP', () => {
    expect(isAtSoftCap(499, UNLIMITED)).toBe(false);
  });

  it('returns false when limit is not UNLIMITED', () => {
    expect(isAtSoftCap(500, 30)).toBe(false);
  });
});
