import { getCompanyLogoUrl, isValidLogoUrl } from './src/lib/company';
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

async function test() {
    const testCases = [
        { name: "Stripe", domain: "stripe.com" },
        { name: "Netflix", domain: "netflix.com" },
        { name: "Local Startup", domain: "example.com" }
    ];

    console.log("--- Logo Resolution Test ---");
    for (const { name, domain } of testCases) {
        console.log(`\nTesting: ${name} (${domain})`);
        try {
            const logo = await getCompanyLogoUrl(name, domain, true); // forceRefresh
            console.log(`Resolved Logo: ${logo}`);
            console.log(`Is Valid: ${isValidLogoUrl(logo)}`);
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

test();
