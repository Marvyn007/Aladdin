import { prisma } from '@/lib/prisma';
import { searchPeople } from './apollo-client';
import { buildQueryHash, type SearchParams } from './query-hash';

export interface ContactSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
}

export interface SearchContactsResponse {
  contacts: ContactSearchResult[];
  totalEntries: number;
  page: number;
  cached: boolean;
}

export async function searchContacts(params: SearchParams): Promise<SearchContactsResponse> {
  const queryHash = buildQueryHash(params);

  const cache = await prisma.contactSearchCache.findFirst({
    where: { queryHash, expiresAt: { gt: new Date() } },
  });

  if (cache) {
    const apolloIds = cache.contactApolloIds as string[];
    const contacts = await prisma.contact.findMany({ where: { apolloId: { in: apolloIds } } });
    return { contacts: contacts.map(toSearchResult), totalEntries: cache.totalEntries ?? 0, page: params.page, cached: true };
  }

  const result = await searchPeople(params);
  const apolloIds: string[] = [];

  for (const person of result.people) {
    await prisma.contact.upsert({
      where: { apolloId: person.id },
      create: {
        apolloId: person.id,
        firstName: person.first_name,
        lastName: person.last_name,
        title: person.title,
        companyName: person.organization?.name ?? null,
        companyDomain: person.organization?.primary_domain ?? null,
        linkedinUrl: person.linkedin_url,
        location: person.city,
      },
      update: {
        firstName: person.first_name,
        lastName: person.last_name,
        title: person.title,
        companyName: person.organization?.name ?? null,
        companyDomain: person.organization?.primary_domain ?? null,
        linkedinUrl: person.linkedin_url,
        location: person.city,
      },
    });
    apolloIds.push(person.id);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.contactSearchCache.create({
    data: {
      queryHash,
      companyDomain: params.companyDomain,
      jobFunction: params.jobFunction,
      managementLevel: params.managementLevel,
      country: params.country,
      page: params.page,
      totalEntries: result.total_entries,
      contactApolloIds: apolloIds,
      expiresAt,
    },
  });

  const contacts = await prisma.contact.findMany({ where: { apolloId: { in: apolloIds } } });
  return { contacts: contacts.map(toSearchResult), totalEntries: result.total_entries, page: params.page, cached: false };
}

function toSearchResult(c: {
  id: string; firstName: string | null; lastName: string | null; title: string | null;
  companyName: string | null; companyDomain: string | null; linkedinUrl: string | null; email: string | null;
}): ContactSearchResult {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    companyName: c.companyName,
    companyDomain: c.companyDomain,
    linkedinUrl: c.linkedinUrl,
    emailRevealed: c.email !== null,
  };
}
