const fs = require('fs');

console.log('--- Environment Validation ---');

const requiredKeys = ['DATABASE_URL', 'DIRECT_URL'];
let hasError = false;

requiredKeys.forEach(key => {
    const value = process.env[key];
    if (!value) {
        console.error(`❌ Missing environment variable: ${key}`);
        hasError = true;
    } else {
        // Check for obvious formatting issues
        if (value.startsWith('"') || value.endsWith('"')) {
            console.error(`❌ ${key} is wrapped in quotes. Remove them in Vercel settings.`);
            hasError = true;
        } else if (value.includes(' ')) {
            console.error(`❌ ${key} contains spaces.`);
            hasError = true;
        } else if (!value.startsWith('postgres')) {
            console.error(`❌ ${key} does not start with 'postgres' (scheme invalid). Value starts with: ${value.substring(0, 10)}...`);
            hasError = true;
        } else {
            console.log(`✅ ${key} is present and looks valid (Length: ${value.length})`);
        }
    }
});

if (hasError) {
    console.error('--- 🛑 Environment Validation Failed ---');
    process.exit(1);
} else {
    console.log('--- ✅ Environment Validation Passed ---');
}
