import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Inngest client configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults baseUrl to localhost:8288 in development when INNGEST_BASE_URL is not set', async () => {
    delete process.env.INNGEST_BASE_URL;
    process.env.NODE_ENV = 'development';
    process.env.INNGEST_EVENT_KEY = 'test-key';
    process.env.INNGEST_SIGNING_KEY = 'signkey-test-abc';

    const { getInngestConfig } = await import('@/lib/inngest');
    const config = getInngestConfig();

    expect(config.baseUrl).toBe('http://localhost:8288');
  });

  it('uses INNGEST_BASE_URL when explicitly set', async () => {
    process.env.INNGEST_BASE_URL = 'http://custom-inngest:9999';
    process.env.NODE_ENV = 'development';
    process.env.INNGEST_EVENT_KEY = 'test-key';
    process.env.INNGEST_SIGNING_KEY = 'signkey-test-abc';

    const { getInngestConfig } = await import('@/lib/inngest');
    const config = getInngestConfig();

    expect(config.baseUrl).toBe('http://custom-inngest:9999');
  });

  it('does not set baseUrl in production when INNGEST_BASE_URL is not set', async () => {
    delete process.env.INNGEST_BASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.INNGEST_EVENT_KEY = 'test-key';
    process.env.INNGEST_SIGNING_KEY = 'signkey-test-abc';

    const { getInngestConfig } = await import('@/lib/inngest');
    const config = getInngestConfig();

    expect(config.baseUrl).toBeUndefined();
  });
});
