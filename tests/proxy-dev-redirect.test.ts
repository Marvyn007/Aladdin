import { describe, it, expect } from 'vitest';
import { shouldSkipLocalHostCanonicalRedirect } from '@/lib/proxy-dev-redirect';

describe('shouldSkipLocalHostCanonicalRedirect', () => {
  it('skips redirect for Inngest serve URL so signed executor POSTs keep the same host', () => {
    expect(shouldSkipLocalHostCanonicalRedirect('/api/inngest')).toBe(true);
  });

  it('does not skip normal API routes', () => {
    expect(shouldSkipLocalHostCanonicalRedirect('/api/jobs')).toBe(false);
    expect(shouldSkipLocalHostCanonicalRedirect('/api/auto-apply/start')).toBe(false);
  });
});
