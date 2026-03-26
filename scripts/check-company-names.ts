import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const results = await (prisma.$queryRawUnsafe(`
    SELECT DISTINCT j.company as job_company, c.name as matched_company, c.logo_url
    FROM jobs j
    LEFT JOIN companies c ON lower(j.company) = lower(c.name)
    WHERE j.company ILIKE '%exmox%'
       OR j.company ILIKE '%GameDuell%'
       OR j.company ILIKE '%Paired%'
       OR j.company ILIKE '%Lyra%'
       OR j.company ILIKE '%Wolt%'
       OR j.company ILIKE '%Onapsis%'
       OR j.company ILIKE '%MILES%'
       OR j.company ILIKE '%zetcom%'
       OR j.company ILIKE '%Automat%'
       OR j.company ILIKE '%Client Accelerators%'
    ORDER BY j.company
  `) as Promise<Array<{job_company: string; matched_company: string | null; logo_url: string | null}>>);

  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => prisma.$disconnect());
