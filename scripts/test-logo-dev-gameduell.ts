import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const secretKey = process.env.LOGO_DEV_SECRET_KEY!;
  const pubKey = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || process.env.LOGO_API_KEY!;

  // 1. Search logo.dev for GameDuell
  console.log('Searching logo.dev for "GameDuell"...');
  const res = await fetch(`https://api.logo.dev/search?q=GameDuell`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) { console.error('Search failed:', res.status); process.exit(1); }

  const data = await res.json() as Array<{ name: string; domain: string; logo_url?: string }>;
  console.log('Results:', data.slice(0, 3).map((d) => `${d.name} → ${d.domain}`));

  const hit = data[0];
  if (!hit) { console.error('No results'); process.exit(1); }

  const logoUrl = hit.logo_url || `https://img.logo.dev/${hit.domain}?token=${pubKey}&size=128`;
  console.log(`\nUsing: domain=${hit.domain}, logoUrl=${logoUrl}`);

  // 2. Save to companies DB
  const company = await prisma.company.findFirst({
    where: { name: { equals: 'GameDuell', mode: 'insensitive' } },
  });

  if (company) {
    await prisma.company.update({
      where: { id: company.id },
      data: { domain: hit.domain, logoUrl, logoFetched: true },
    });
    console.log('✓ Updated existing GameDuell record in companies DB');
  } else {
    await prisma.company.create({
      data: { name: 'GameDuell', domain: hit.domain, logoUrl, logoFetched: true },
    });
    console.log('✓ Inserted new GameDuell record in companies DB');
  }

  // 3. Confirm what's now in DB
  const saved = await prisma.company.findFirst({ where: { name: { equals: 'GameDuell', mode: 'insensitive' } } });
  console.log('\nSaved in DB:', saved);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
