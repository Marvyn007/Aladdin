import { describe, it, expect } from 'vitest';
import { buildQueryHash } from '@/lib/contacts/query-hash';

describe('buildQueryHash', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('is deterministic for the same params', () => {
    const params = { companyDomain: 'stripe.com', jobFunction: 'engineering', managementLevel: 'senior', country: 'US', page: 1 };
    expect(buildQueryHash(params)).toBe(buildQueryHash(params));
  });

  it('differs when page changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    const b = buildQueryHash({ companyDomain: 'stripe.com', page: 2 });
    expect(a).not.toBe(b);
  });

  it('differs when companyDomain changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    const b = buildQueryHash({ companyDomain: 'openai.com', page: 1 });
    expect(a).not.toBe(b);
  });

  it('treats undefined and omitted optional params the same way', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', jobFunction: undefined, page: 1 });
    const b = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    expect(a).toBe(b);
  });
});
