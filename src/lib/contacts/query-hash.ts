import { createHash } from 'crypto';

export interface SearchParams {
  companyDomain: string;
  jobFunction?: string;
  managementLevel?: string;
  country?: string;
  page: number;
}

export function buildQueryHash(params: SearchParams): string {
  const key = [
    params.companyDomain,
    params.jobFunction ?? '',
    params.managementLevel ?? '',
    params.country ?? '',
    params.page,
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}
