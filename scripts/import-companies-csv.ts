/**
 * Import companies from the legacy CSV dump into the current database.
 *
 * Rules:
 * 1. Insert every row from the CSV.
 * 2. If a company with the same name already exists, replace it with the CSV row.
 * 3. After the import, any company that has no logoUrl gets a logo.dev URL.
 *
 * Usage:  npx ts-node --project tsconfig.json -e "require('./scripts/import-companies-csv')"
 *    or:  node --loader ts-node/esm scripts/import-companies-csv.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── CSV parser (handles quoted fields with embedded commas/newlines) ──────────
function parseCSV(raw: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuote && raw[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (cur.length) { lines.push(cur); cur = ''; }
      if (ch === '\r' && raw[i + 1] === '\n') i++;
    } else {
      cur += ch;
    }
  }
  if (cur.length) lines.push(cur);

  const splitLine = (line: string): string[] => {
    const cols: string[] = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { field += '"'; i++; }
        else { q = !q; }
      } else if (ch === ',' && !q) {
        cols.push(field); field = '';
      } else {
        field += ch;
      }
    }
    cols.push(field);
    return cols;
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

// ─── logo.dev URL builder ──────────────────────────────────────────────────────
function logoDevUrl(domain: string): string {
  return `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6BeA`;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.join(
    process.cwd(),
    'shy-shadow-67234565_aladdin_prod_neondb_2026-03-22_19-15-16.csv',
  );

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`Parsed ${rows.length} companies from CSV.`);

  let inserted = 0;
  let replaced = 0;
  let skipped = 0;

  for (const row of rows) {
    const { id, name, domain, logo_url, logo_fetched } = row;
    if (!name) { skipped++; continue; }

    const logoUrl  = logo_url  || null;
    const logoFetched = logo_fetched === 't' || logo_fetched === 'true';
    const domainVal = domain || null;

    // Check for existing company by name (case-insensitive-friendly via exact Prisma match)
    const existing = await prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      // Replace: delete old, create new with CSV id
      await prisma.company.delete({ where: { id: existing.id } });
      await prisma.company.create({
        data: {
          id,
          name,
          domain: domainVal,
          logoUrl,
          logoFetched,
        },
      });
      replaced++;
      console.log(`[replaced] ${name}`);
    } else {
      // Insert fresh
      await prisma.company.create({
        data: {
          id,
          name,
          domain: domainVal,
          logoUrl,
          logoFetched,
        },
      });
      inserted++;
      console.log(`[inserted] ${name}`);
    }
  }

  console.log(`\n✓ Import done — inserted: ${inserted}, replaced: ${replaced}, skipped: ${skipped}`);

  // ─── Phase 2: fix missing logos with logo.dev ──────────────────────────────
  console.log('\nFixing missing logos with logo.dev …');
  const noLogo = await prisma.company.findMany({
    where: { logoUrl: null },
  });
  console.log(`Companies without logoUrl: ${noLogo.length}`);

  let logoFixed = 0;
  for (const c of noLogo) {
    if (!c.domain) {
      console.log(`[skip logo] ${c.name} — no domain`);
      continue;
    }
    const url = logoDevUrl(c.domain);
    await prisma.company.update({
      where: { id: c.id },
      data: { logoUrl: url, logoFetched: true },
    });
    console.log(`[logo.dev] ${c.name} → ${url}`);
    logoFixed++;
  }

  console.log(`\n✓ Logo fix done — ${logoFixed} companies updated.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
