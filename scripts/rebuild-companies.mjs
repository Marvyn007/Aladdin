import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envPath = join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

function isValidLogoUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('fallback/lettermark') || lower.includes('/lettermark/')) {
        return false;
    }
    return true;
}

async function resolveLogoUrl(companyName, companyDomain) {
    // 1. Check if we can get a logo from a standard provider (Favicon fallback)
    if (companyDomain) {
        const domainStr = companyDomain.replace(/^https?:\/\//, '').split('/')[0];
        // Check Google S2 Favicon
        const url = `https://s2.googleusercontent.com/s2/favicons?domain=${domainStr}&sz=128`;
        try {
            const check = await fetch(url, { method: 'HEAD' });
            if (check.ok) return url;
        } catch (e) { }
    }
    return null;
}

async function rebuild() {
    console.log('--- Rebuilding Company Cache for Existing Jobs ---');

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL missing');
        return;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        // 1. Get unique companies
        const res = await client.query('SELECT DISTINCT company FROM jobs WHERE company IS NOT NULL AND company != \'\'');
        const companies = res.rows.map(r => r.company);
        console.log(`Found ${companies.length} unique companies in jobs table.`);

        for (const company of companies) {
            console.log(`Processing: ${company}`);

            try {
                // Search Brandfetch
                const searchRes = await fetch(
                    `https://api.brandfetch.io/v2/search/${encodeURIComponent(company)}`,
                    { headers: { 'Accept': 'application/json' } }
                );

                let finalName = company;
                let finalDomain = null;
                let finalLogo = null;

                if (searchRes.ok) {
                    const data = await searchRes.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const item = data[0];
                        finalName = item.name || company;
                        finalDomain = item.domain || `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                        finalLogo = item.icon || null;
                    }
                }

                if (!finalDomain) {
                    finalDomain = `${finalName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                }

                // If no logo from Brandfetch or it was invalid, try fallback resolution
                if (!isValidLogoUrl(finalLogo)) {
                    const fallbackLogo = await resolveLogoUrl(finalName, finalDomain);
                    if (isValidLogoUrl(fallbackLogo)) {
                        finalLogo = fallbackLogo;
                    } else {
                        finalLogo = null;
                    }
                }

                const logoFetched = isValidLogoUrl(finalLogo);

                await client.query(`
                    INSERT INTO companies (id, name, domain, logo_url, logo_fetched, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
                    ON CONFLICT (name) DO UPDATE SET
                        domain = EXCLUDED.domain,
                        logo_url = EXCLUDED.logo_url,
                        logo_fetched = EXCLUDED.logo_fetched,
                        updated_at = NOW()
                    WHERE companies.logo_fetched = false
                `, [company, finalDomain, finalLogo, logoFetched]);

                console.log(`  -> Saved ${company} (${finalDomain}): ${logoFetched ? 'Logo Found' : 'No Valid Logo'}`);
            } catch (inner) {
                console.error(`  -> Error processing ${company}:`, inner.message);
            }

            await new Promise(r => setTimeout(r, 200));
        }

        client.release();
    } catch (e) {
        console.error('Fatal error:', e);
    } finally {
        await pool.end();
    }

    console.log('--- Rebuild Complete ---');
}

rebuild();
