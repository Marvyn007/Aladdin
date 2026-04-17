import { prisma } from '@/lib/prisma';
import { searchPeople, ProspeoAuthError, ProspeoRateLimitError } from './prospeo-client';
import { buildQueryHash, type SearchParams } from './query-hash';

export interface ContactSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
  /** Populated when the email is already stored in DB (emailRevealed === true) */
  email: string | null;
  emailStatus: string | null;
  location: { city: string | null; country: string | null } | null;
}

export interface SearchContactsResponse {
  contacts: ContactSearchResult[];
  totalEntries: number;
  cached: boolean;
}

const MAX_PAGES = 3;
const PAGE_SIZE = 25;

function encodeLocation(city: string | null, country: string | null): string | null {
  if (!city && !country) return null;
  return JSON.stringify({ city, country });
}

function decodeLocation(raw: string | null): { city: string | null; country: string | null } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { city: string | null; country: string | null };
  } catch {
    return { city: raw, country: null }; // legacy plain-string fallback
  }
}

export async function searchContacts(params: SearchParams): Promise<SearchContactsResponse> {
  const queryHash = buildQueryHash(params);

  const cache = await prisma.contactSearchCache.findFirst({
    where: { queryHash, expiresAt: { gt: new Date() } },
  });

  if (cache) {
    const providerIds = cache.contactApolloIds as string[];
    const contacts = await prisma.contact.findMany({ where: { apolloId: { in: providerIds } } });
    return { contacts: contacts.map(toSearchResult), totalEntries: cache.totalEntries ?? 0, cached: true };
  }

  const providerIds: string[] = [];
  let totalEntries = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let pageResult;
    try {
      pageResult = await searchPeople({ companyDomain: params.companyDomain, page });
    } catch (err) {
      if (err instanceof ProspeoAuthError || err instanceof ProspeoRateLimitError) throw err;
      console.error(`[search-contacts] Prospeo error on page ${page}, stopping:`, err);
      break;
    }

    totalEntries = pageResult.total;

    for (const person of pageResult.results) {
      const pid = `prospeo:${person.person_id}`;
      const locationJson = encodeLocation(
        person.location?.city ?? null,
        person.location?.country ?? null,
      );
      await prisma.contact.upsert({
        where: { apolloId: pid },
        create: {
          apolloId: pid,
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.current_job_title,
          companyName: null,
          companyDomain: params.companyDomain,
          linkedinUrl: person.linkedin_url,
          location: locationJson,
        },
        update: {
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.current_job_title,
          linkedinUrl: person.linkedin_url,
          location: locationJson,
        },
      });
      providerIds.push(pid);
    }

    if (pageResult.results.length < PAGE_SIZE) break;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.contactSearchCache.create({
    data: {
      queryHash,
      companyDomain: params.companyDomain,
      jobFunction: null,
      managementLevel: null,
      country: null,
      page: 1,
      totalEntries,
      contactApolloIds: providerIds,
      expiresAt,
    },
  });

  const contacts = await prisma.contact.findMany({ where: { apolloId: { in: providerIds } } });
  return { contacts: contacts.map(toSearchResult), totalEntries, cached: false };
}

function toSearchResult(c: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: string | null;
  location: string | null;
}): ContactSearchResult {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    companyDomain: c.companyDomain,
    linkedinUrl: c.linkedinUrl,
    emailRevealed: c.email !== null,
    email: c.email,
    emailStatus: c.emailStatus,
    location: decodeLocation(c.location),
  };
}
