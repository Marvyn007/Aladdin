import axios from 'axios';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

export class ApolloAuthError extends Error {
  constructor(msg = 'Apollo authentication failed') { super(msg); this.name = 'ApolloAuthError'; }
}
export class ApolloRateLimitError extends Error {
  constructor() { super('Apollo rate limit exceeded'); this.name = 'ApolloRateLimitError'; }
}
export class ApolloNotFoundError extends Error {
  constructor() { super('Apollo contact not found'); this.name = 'ApolloNotFoundError'; }
}
export class ApolloServiceError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ApolloServiceError'; }
}
export class ApolloPlanError extends Error {
  constructor(msg = 'This Apollo.io endpoint requires a paid plan.') { super(msg); this.name = 'ApolloPlanError'; }
}

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new ApolloAuthError('APOLLO_API_KEY is not set');
  return key;
}

function getHeaders(key: string): Record<string, string> {
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' };
}

function handleAxiosError(err: unknown): never {
  const resp = (err as { response?: { status?: number; data?: unknown } })?.response;
  if (resp?.status !== undefined) {
    console.error(`[apollo-client] HTTP ${resp.status}`, resp.data);
    if (resp.status === 401) throw new ApolloAuthError('Invalid Apollo API key');
    if (resp.status === 403) {
      const msg = (resp.data as { error?: string })?.error ?? 'Apollo plan does not allow this endpoint';
      throw new ApolloPlanError(msg);
    }
    if (resp.status === 429) throw new ApolloRateLimitError();
    if (resp.status === 404) throw new ApolloNotFoundError();
    throw new ApolloServiceError(`Apollo API error: ${resp.status}`);
  }
  throw err;
}

export interface ApolloPersonResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
  organization: { name: string | null; primary_domain: string | null } | null;
}

export interface ApolloSearchParams {
  companyDomain: string;
  jobFunction?: string;
  managementLevel?: string;
  country?: string;
  page: number;
}

export interface ApolloSearchResponse {
  people: ApolloPersonResult[];
  total_entries: number;
}

export async function searchPeople(params: ApolloSearchParams): Promise<ApolloSearchResponse> {
  const key = getApiKey();
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/people/search`,
      {
        api_key: key,
        q_organization_domains_list: [params.companyDomain],
        ...(params.jobFunction     ? { person_titles:      [params.jobFunction]     } : {}),
        ...(params.managementLevel ? { person_seniorities: [params.managementLevel] } : {}),
        ...(params.country         ? { person_locations:   [params.country]         } : {}),
        page: params.page,
        per_page: 25,
      },
      { headers: getHeaders(key) },
    );
    return data as ApolloSearchResponse;
  } catch (err) {
    handleAxiosError(err);
  }
}

export interface ApolloPersonDetail {
  email: string | null;
  email_status: string | null;
}

export async function enrichPerson(apolloPersonId: string): Promise<ApolloPersonDetail> {
  const key = getApiKey();
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/people/match`,
      { api_key: key, id: apolloPersonId, reveal_personal_emails: true },
      { headers: getHeaders(key) },
    );
    return data.person as ApolloPersonDetail;
  } catch (err) {
    handleAxiosError(err);
  }
}
