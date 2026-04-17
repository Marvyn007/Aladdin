import axios from 'axios';

const PROSPEO_BASE = 'https://api.prospeo.io';

export class ProspeoAuthError extends Error {
  constructor(msg = 'Prospeo authentication failed') { super(msg); this.name = 'ProspeoAuthError'; }
}
export class ProspeoRateLimitError extends Error {
  constructor() { super('Prospeo rate limit exceeded'); this.name = 'ProspeoRateLimitError'; }
}
export class ProspeoNotFoundError extends Error {
  constructor() { super('Person not found in Prospeo'); this.name = 'ProspeoNotFoundError'; }
}
export class ProspeoServiceError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ProspeoServiceError'; }
}

function getApiKey(): string {
  const key = process.env.PROSPEO_API_KEY;
  if (!key) throw new ProspeoAuthError('PROSPEO_API_KEY is not set');
  return key;
}

function headers(key: string) {
  return { 'X-KEY': key, 'Content-Type': 'application/json' };
}

function handleError(err: unknown): never {
  const resp = (err as { response?: { status?: number; data?: unknown } })?.response;
  if (resp?.status !== undefined) {
    console.error(`[prospeo-client] HTTP ${resp.status}`, resp.data);
    if (resp.status === 401 || resp.status === 403) throw new ProspeoAuthError('Invalid Prospeo API key');
    if (resp.status === 404) throw new ProspeoNotFoundError();
    if (resp.status === 429) throw new ProspeoRateLimitError();
    throw new ProspeoServiceError(`Prospeo API error: ${resp.status}`);
  }
  throw err;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProspeoPersonResult {
  person_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  linkedin_url: string | null;
  current_job_title: string | null;
  headline: string | null;
  location: { country: string | null; city: string | null } | null;
}

export interface ProspeoSearchParams {
  companyDomain: string;
  page: number;
}

export interface ProspeoSearchResponse {
  results: ProspeoPersonResult[];
  total: number;
}

export interface ProspeoEnrichResult {
  email: string | null;
  emailStatus: string | null;
}

// ── Search Person ──────────────────────────────────────────────────────────

export async function searchPeople(params: ProspeoSearchParams): Promise<ProspeoSearchResponse> {
  const key = getApiKey();

  try {
    const { data } = await axios.post(
      `${PROSPEO_BASE}/search-person`,
      {
        page: params.page,
        filters: {
          company: { websites: { include: [params.companyDomain] } },
        },
      },
      { headers: headers(key) },
    );

    const payload = data as {
      error: boolean;
      results?: Array<{ person: ProspeoPersonResult; company: unknown }>;
      pagination?: { total_count: number };
    };

    if (payload.error) throw new ProspeoServiceError('Prospeo returned an error response');

    return {
      results: (payload.results ?? []).map(r => r.person),
      total: payload.pagination?.total_count ?? 0,
    };
  } catch (err) {
    if ((err as { name?: string })?.name?.startsWith('Prospeo')) throw err;
    handleError(err);
  }
}

// ── Enrich Person (reveal email) ───────────────────────────────────────────

export async function enrichPerson(
  personId: string,
  firstName: string | null,
  lastName: string | null,
  companyDomain: string,
): Promise<ProspeoEnrichResult> {
  const key = getApiKey();

  try {
    const { data } = await axios.post(
      `${PROSPEO_BASE}/enrich-person`,
      {
        only_verified_email: false,
        data: {
          person_id: personId,
          first_name: firstName,
          last_name: lastName,
          company_website: companyDomain,
        },
      },
      { headers: headers(key) },
    );

    const payload = data as {
      error: boolean;
      person?: { email?: { email?: string; status?: string } };
    };

    if (payload.error) throw new ProspeoNotFoundError();

    const emailObj = payload.person?.email;
    return {
      email: emailObj?.email ?? null,
      emailStatus: emailObj?.status ?? null,
    };
  } catch (err) {
    if ((err as { name?: string })?.name?.startsWith('Prospeo')) throw err;
    handleError(err);
  }
}
