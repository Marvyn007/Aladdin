import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANIES = [
  { name: 'exmox GmbH',         domain: 'exmox.com' },
  { name: 'GameDuell',           domain: 'gameduell.com' },
  { name: 'Paired',              domain: 'paired.com' },
  { name: 'Lyra Health',         domain: 'lyrahealth.com' },
  { name: 'Client Accelerators', domain: 'clientaccelerators.com' },
  { name: 'Wolt',                domain: 'wolt.com' },
  { name: 'Wolt - English',      domain: 'wolt.com' },
  { name: 'Onapsis',             domain: 'onapsis.com' },
  { name: 'MILES Mobility',      domain: 'miles-mobility.com' },
  { name: 'zetcom group',        domain: 'zetcom.com' },
  { name: 'Automat-it',          domain: 'automat-it.com' },
];

function logoDevUrl(domain: string) {
  return `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6BeA`;
}

async function main() {
  for (const { name, domain } of COMPANIES) {
    const company = await prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (!company) {
      console.log(`[not found] ${name} — inserting new record`);
      await prisma.company.create({
        data: { name, domain, logoUrl: logoDevUrl(domain), logoFetched: true },
      });
      continue;
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { domain, logoUrl: logoDevUrl(domain), logoFetched: true },
    });
    console.log(`[updated] ${name} → ${logoDevUrl(domain)}`);
  }

  console.log('\nDone.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
