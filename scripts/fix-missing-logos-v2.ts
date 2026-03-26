/**
 * For each target company:
 * 1. Try logo.dev — if it returns a real image (non-tiny response), use it.
 * 2. Otherwise scrape the company's own website for their favicon.
 * 3. Persist whichever URL wins to the companies table.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANIES = [
  { name: 'exmox GmbH',         domain: 'exmox.com' },
  { name: 'GameDuell',           domain: 'gameduell.com' },
  { name: 'Paired',              domain: 'paired.com' },
  { name: 'Lyra Health',         domain: 'lyrahealth.com' },
  { name: 'Client Accelerators', domain: 'clientaccelerators.com' },
  { name: 'Wolt - English',      domain: 'wolt.com' },
  { name: 'Onapsis',             domain: 'onapsis.com' },
  { name: 'MILES Mobility',      domain: 'miles-mobility.com' },
  { name: 'zetcom group',        domain: 'zetcom.com' },
  { name: 'Automat-it',          domain: 'automat-it.com' },
];

// logo.dev returns a 1×1 transparent pixel (~68 bytes) when it has no logo
const LOGO_DEV_EMPTY_THRESHOLD = 500; // bytes

async function checkLogoDevUrl(domain: string): Promise<string | null> {
  const url = `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6BeA&size=128`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < LOGO_DEV_EMPTY_THRESHOLD) {
      console.log(`  logo.dev: empty/placeholder (${buf.byteLength}b)`);
      return null;
    }
    console.log(`  logo.dev: OK (${buf.byteLength}b)`);
    return url;
  } catch {
    return null;
  }
}

async function getFaviconFromSite(domain: string): Promise<string | null> {
  // Strategy 1: Try /favicon.ico directly
  // Strategy 2: Fetch homepage HTML and look for <link rel="icon"> tags
  // Strategy 3: Fall back to Google Favicons (reliable, not Clearbit)

  const homepage = `https://${domain}`;

  try {
    const res = await fetch(homepage, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AladdinBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Extract all icon <link> tags
    const iconLinks: { rel: string; href: string }[] = [];
    const linkRe = /<link[^>]+rel=["']([^"']*icon[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const linkRe2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) iconLinks.push({ rel: m[1], href: m[2] });
    while ((m = linkRe2.exec(html)) !== null) iconLinks.push({ rel: m[2], href: m[1] });

    // Prefer apple-touch-icon > shortcut icon > icon, in that order
    const preferred = ['apple-touch-icon', 'shortcut icon', 'icon'];
    for (const rel of preferred) {
      const match = iconLinks.find((l) => l.rel.toLowerCase().includes(rel.replace('shortcut icon','shortcut')));
      if (match) {
        let href = match.href;
        if (href.startsWith('//')) href = 'https:' + href;
        else if (href.startsWith('/')) href = `https://${domain}${href}`;
        else if (!href.startsWith('http')) href = `https://${domain}/${href}`;
        console.log(`  favicon from HTML <link rel="${match.rel}">: ${href}`);
        return href;
      }
    }

    // Try /favicon.ico directly
    const icoUrl = `https://${domain}/favicon.ico`;
    const icoRes = await fetch(icoUrl, { signal: AbortSignal.timeout(5000) });
    if (icoRes.ok) {
      const buf = await icoRes.arrayBuffer();
      if (buf.byteLength > 100) {
        console.log(`  favicon.ico: ${icoUrl} (${buf.byteLength}b)`);
        return icoUrl;
      }
    }
  } catch (err) {
    console.log(`  site fetch failed: ${err}`);
  }

  // Final fallback: Google Favicons API (works for almost every domain)
  const googleUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
  console.log(`  fallback: Google Favicons → ${googleUrl}`);
  return googleUrl;
}

async function main() {
  for (const { name, domain } of COMPANIES) {
    console.log(`\nProcessing: ${name} (${domain})`);

    // 1. Try logo.dev
    let logoUrl = await checkLogoDevUrl(domain);

    // 2. Scrape favicon from company site
    if (!logoUrl) {
      logoUrl = await getFaviconFromSite(domain);
    }

    if (!logoUrl) {
      console.log(`  FAILED — no logo found`);
      continue;
    }

    // Upsert into companies table
    const existing = await prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      await prisma.company.update({
        where: { id: existing.id },
        data: { domain, logoUrl, logoFetched: true },
      });
    } else {
      await prisma.company.create({
        data: { name, domain, logoUrl, logoFetched: true },
      });
    }
    console.log(`  ✓ saved: ${logoUrl}`);
  }

  console.log('\nAll done.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
