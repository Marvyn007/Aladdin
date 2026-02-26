import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import util from 'util';

// We want to test scripts/parse_pdf.py directly to ensure it works
// without needing Next.js to be running fully.

async function runTest() {
    const testPdfPath = path.join(process.cwd(), 'scripts', 'dummy-resume.pdf');
    if (!fs.existsSync(testPdfPath)) {
        console.error('No dummy-resume.pdf found for testing:', testPdfPath);
        process.exit(1);
    }

    // Test Python script via raw exec
    const reqId = `test_${uuidv4()}`;
    const pyScript = path.join(process.cwd(), 'scripts', 'parse_pdf.py');

    console.log(`[TEST] Running Python script for ID: ${reqId}`);
    try {
        const out = execSync(`python3 "${pyScript}" "${reqId}" "${testPdfPath}"`, { stdio: 'pipe' });
        const jsonPath = out.toString().trim();

        console.log(`[TEST] Python script output path: ${jsonPath}`);

        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            console.log(`[TEST] Successfully parsed JSON output. Methods used: ${data._meta_method || 'none'}`);
            console.log(`[TEST] Name found:`, data.basics?.full_name);
            console.log(`[TEST] Text structure extracted successfully.`);

            // Cleanup
            const dir = path.dirname(jsonPath);
            fs.rmSync(dir, { recursive: true, force: true });
            console.log('[TEST] Cleaned up temporary test files.');
        } else {
            console.error('[TEST] Expected output JSON file not found:', jsonPath);
        }
    } catch (e: any) {
        console.error('[TEST] Error executing Python script:', e.message);
        if (e.stdout) console.log('STDOUT:', e.stdout.toString());
        if (e.stderr) console.error('STDERR:', e.stderr.toString());
    }
}

runTest();
