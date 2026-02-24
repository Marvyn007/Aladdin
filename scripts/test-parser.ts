import { parseResumeFromPdfStrict } from '../src/lib/gemini-strict';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function test() {
    console.log('--- Starting Strict Parser Test ---');
    try {
        const dummyPath = path.join(__dirname, 'dummy-resume.pdf');

        if (!fs.existsSync(dummyPath)) {
            console.error('Please put a dummy-resume.pdf in the scripts folder to test.');
            return;
        }

        const buffer = fs.readFileSync(dummyPath);
        console.log(`Loaded PDF: ${buffer.length} bytes`);

        const result = await parseResumeFromPdfStrict(buffer);

        console.log('\n--- FINAL RESULT ---');
        console.log('Success:', result.success);

        if (!result.success) {
            console.error('\nFAILED TESTS:');
            result.failedTests?.forEach(t => console.error(' ❌', t));

            // console.log('\nRAW TEXT EXTRACT:\n', result.rawTextExtract); // Uncomment to see what OCR saw
        } else {
            console.log('\nPASSED ALL TESTS! JSON:\n');
            console.log(JSON.stringify(result.data, null, 2));
        }

    } catch (e: any) {
        console.error('Script Error:', e.message);
    }
}

test();
