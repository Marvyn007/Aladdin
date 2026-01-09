
import * as fs from 'fs';
import * as path from 'path';

// 1. Load Env (Helper)
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                    if (!process.env[key]) process.env[key] = value;
                }
            });
            console.log('Loaded .env.local');
        }
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
}
loadEnv();

// 2. Import Router
// We need to use dynamic import or require because simple import might fail with tsx if paths issue
// But we assume tsx handles it.
import { routeAICall, getStatusMessage } from '../src/lib/ai-router';

// 3. Run
async function run() {
    console.log('--- VERIFICATION START ---');
    console.log('Checking Status:', getStatusMessage());

    try {
        console.log('Initiating routeAICall("Reply with verified")...');
        const res = await routeAICall('Reply with verified');
        console.log('--- SUCCESS ---');
        console.log('Response:', res);
    } catch (e: any) {
        console.error('--- FAILURE ---');
        console.error(e.message);
    }
}

run();
