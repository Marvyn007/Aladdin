import { describe, it, expect } from 'vitest';
import { buildQueryHash } from '@/lib/contacts/query-hash';

describe('buildQueryHash', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = buildQueryHash({ companyDomain: 'stripe.com' });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('is deterministic for the same domain', () => {
    const params = { companyDomain: 'stripe.com' };
    expect(buildQueryHash(params)).toBe(buildQueryHash(params));
  });

  it('differs when companyDomain changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com' });
    const b = buildQueryHash({ companyDomain: 'openai.com' });
    expect(a).not.toBe(b);
  });
});
