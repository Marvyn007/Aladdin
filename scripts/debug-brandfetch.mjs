import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

async function debug() {
    const company = "Stripe";
    const searchRes = await fetch(
        `https://api.brandfetch.io/v2/search/${encodeURIComponent(company)}`,
        { headers: { 'Accept': 'application/json' } }
    );
    const data = await searchRes.json();
    console.log(JSON.stringify(data, null, 2));
}

debug();
