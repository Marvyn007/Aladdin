import { getCompanyLogoUrl, saveCompanyToDb, searchCompaniesInDb } from './src/lib/company';
import dotenv from 'dotenv';
import fs from 'fs';
import { join } from 'path';

// Load .env.local
const envPath = join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function debug() {
    const query = "Vercel";
    console.log(`--- Debugging Autocomplete for "${query}" ---`);

    // 1. Search DB
    const dbResults = await searchCompaniesInDb(query);
    console.log(`DB Results: ${JSON.stringify(dbResults, null, 2)}`);

    if (dbResults.length === 0) {
        // 2. Fetch Brandfetch (simulated)
        console.log("Fetching from Brandfetch...");
        const res = await fetch(`https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}`, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
            const data = await res.json();
            console.log(`Brandfetch Data: ${JSON.stringify(data, null, 2)}`);
            if (Array.isArray(data)) {
                for (const item of data.slice(0, 1)) {
                    const name = item.name || item.domain || query;
                    const domain = item.domain || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                    console.log(`Resolving logo for: ${name} (${domain})`);
                    const logo = await getCompanyLogoUrl(name, domain, true);
                    console.log(`Resolved Logo: ${logo}`);
                    await saveCompanyToDb(name, domain, logo);
                }
            }
        } else {
            console.error(`Brandfetch Error: ${res.status}`);
        }
    }
}

debug();
