import { createHash } from 'crypto';

export interface SearchParams {
  companyDomain: string;
}

export function buildQueryHash(params: SearchParams): string {
  return createHash('sha256').update(params.companyDomain.toLowerCase()).digest('hex');
}
