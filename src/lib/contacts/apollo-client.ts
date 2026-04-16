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

function getHeaders(): Record<string, string> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new ApolloAuthError('APOLLO_API_KEY is not set');
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' };
}

function handleAxiosError(err: unknown): never {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status !== undefined) {
    if (status === 401) throw new ApolloAuthError('Invalid Apollo API key');
    if (status === 429) throw new ApolloRateLimitError();
    if (status === 404) throw new ApolloNotFoundError();
    throw new ApolloServiceError(`Apollo API error: ${status}`);
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
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/mixed_people/search`,
      {
        q_organization_domains_list: [params.companyDomain],
        ...(params.jobFunction     ? { person_titles:      [params.jobFunction]     } : {}),
        ...(params.managementLevel ? { person_seniorities: [params.managementLevel] } : {}),
        ...(params.country         ? { person_locations:   [params.country]         } : {}),
        page: params.page,
        per_page: 25,
      },
      { headers: getHeaders() },
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
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/people/match`,
      { id: apolloPersonId, reveal_personal_emails: true },
      { headers: getHeaders() },
    );
    return data.person as ApolloPersonDetail;
  } catch (err) {
    handleAxiosError(err);
  }
}
