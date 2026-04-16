import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  searchPeople,
  enrichPerson,
  ApolloAuthError,
  ApolloRateLimitError,
  ApolloNotFoundError,
} from '@/lib/contacts/apollo-client';

const mockedPost = vi.fn();
(axios as unknown as { post: typeof mockedPost }).post = mockedPost;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APOLLO_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.APOLLO_API_KEY;
});

describe('searchPeople', () => {
  it('posts to /mixed_people/search with correct headers and body', async () => {
    mockedPost.mockResolvedValue({ data: { people: [], total_entries: 0 } });

    const result = await searchPeople({ companyDomain: 'stripe.com', page: 1 });

    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.apollo.io/api/v1/mixed_people/search',
      expect.objectContaining({ q_organization_domains_list: ['stripe.com'], page: 1, per_page: 25 }),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }) })
    );
    expect(result.total_entries).toBe(0);
  });

  it('includes person_seniorities when managementLevel is provided', async () => {
    mockedPost.mockResolvedValue({ data: { people: [], total_entries: 0 } });
    await searchPeople({ companyDomain: 'stripe.com', managementLevel: 'senior', page: 1 });
    expect(mockedPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ person_seniorities: ['senior'] }),
      expect.any(Object)
    );
  });

  it('throws ApolloRateLimitError on 429', async () => {
    mockedPost.mockRejectedValue({ response: { status: 429 } });
    await expect(searchPeople({ companyDomain: 'stripe.com', page: 1 })).rejects.toBeInstanceOf(ApolloRateLimitError);
  });

  it('throws ApolloAuthError when APOLLO_API_KEY is not set', async () => {
    delete process.env.APOLLO_API_KEY;
    await expect(searchPeople({ companyDomain: 'stripe.com', page: 1 })).rejects.toBeInstanceOf(ApolloAuthError);
  });
});

describe('enrichPerson', () => {
  it('posts to /people/match with reveal_personal_emails: true', async () => {
    mockedPost.mockResolvedValue({
      data: { person: { email: 'jane@stripe.com', email_status: 'verified' } },
    });

    const result = await enrichPerson('apollo-person-123');

    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.apollo.io/api/v1/people/match',
      { id: 'apollo-person-123', reveal_personal_emails: true },
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }) })
    );
    expect(result.email).toBe('jane@stripe.com');
    expect(result.email_status).toBe('verified');
  });

  it('throws ApolloNotFoundError on 404', async () => {
    mockedPost.mockRejectedValue({ response: { status: 404 } });
    await expect(enrichPerson('missing-id')).rejects.toBeInstanceOf(ApolloNotFoundError);
  });
});
