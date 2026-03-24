import type { CompanyLogoResolution } from './company';

export interface CompanyBackfillRow {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  logo_url: string | null;
}

export interface CompanyBackfillLogger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export interface CompanyBackfillOptions {
  logger?: CompanyBackfillLogger;
  throttleMs?: number;
  sleeper?: (ms: number) => Promise<void>;
}

export interface CompanyBackfillSummary {
  updated: number;
  skipped: number;
  missed: number;
  errors: number;
}

const DEFAULT_THROTTLE_MS = 180;

async function defaultSleeper(ms: number) {
  if (process.env.BACKFILL_FAST) {
    return;
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function hydrateCompanyLogos(
  rows: CompanyBackfillRow[],
  ensureCompanyProfile: (input: {
    name: string;
    domain?: string | null;
    websiteUrl?: string | null;
  }) => Promise<CompanyLogoResolution>,
  options: CompanyBackfillOptions = {}
): Promise<CompanyBackfillSummary> {
  const logger = options.logger ?? console;
  const sleeper = options.sleeper ?? defaultSleeper;
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;

  let updated = 0;
  let skipped = 0;
  let missed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const resolution = await ensureCompanyProfile({
        name: row.name,
        domain: row.domain,
        websiteUrl: row.website_url,
      });

      if (resolution.logoUrl) {
        if (!row.logo_url || row.logo_url !== resolution.logoUrl) {
          updated += 1;
          logger.log(`OK   ${row.name}: ${resolution.logoUrl} (${resolution.source}, confidence=${resolution.confidence})`);
        } else {
          skipped += 1;
          logger.log(`SKIP ${row.name}: already has ${resolution.source}`);
        }
      } else {
        missed += 1;
        logger.log(`MISS ${row.name}: ${resolution.domain || row.website_url || 'no domain'} (no logo found)`);
      }
    } catch (error) {
      errors += 1;
      logger.error(`ERR  ${row.name}: ${error?.message || error}`);
    }

    await sleeper(throttleMs);
  }

  logger.log(`Done. Updated=${updated} Skipped=${skipped} Missed=${missed} Errors=${errors}`);
  return { updated, skipped, missed, errors };
}
