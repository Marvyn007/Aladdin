import { describe, it, expect } from 'vitest';
import { shouldUseInlineAutoApply } from '@/lib/auto-apply/auto-apply-mode';

describe('shouldUseInlineAutoApply', () => {
  it('is true when AUTO_APPLY_INLINE is true', () => {
    expect(
      shouldUseInlineAutoApply({
        AUTO_APPLY_INLINE: 'true',
        NODE_ENV: 'production',
      })
    ).toBe(true);
  });

  it('is false when AUTO_APPLY_INLINE is false', () => {
    expect(
      shouldUseInlineAutoApply({
        AUTO_APPLY_INLINE: 'false',
        NODE_ENV: 'development',
      })
    ).toBe(false);
  });

  it('defaults to inline in development when unset', () => {
    expect(shouldUseInlineAutoApply({ NODE_ENV: 'development' })).toBe(true);
  });

  it('defaults to Inngest (not inline) in production when unset', () => {
    expect(shouldUseInlineAutoApply({ NODE_ENV: 'production' })).toBe(false);
  });
});
