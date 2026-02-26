import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';
import FormData from 'form-data';

const execAsync = util.promisify(exec);
export const runtime = 'nodejs';

/**
 * Executes the Python parsing script as a fallback.
 */
async function runPythonFallback(reqId: string, pdfPath: string): Promise<any> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'parse_pdf.py');
    const pythonCmd = `python3 "${scriptPath}" "${reqId}" "${pdfPath}"`;

    try {
        const { stdout, stderr } = await execAsync(pythonCmd);

        if (stderr && !stderr.includes('Warning')) {
            console.error(`[parse-resume] Python Stderr: ${stderr}`); // Only log to console internally
        }

        const outPath = stdout.trim();
        if (fs.existsSync(outPath)) {
            const raw = fs.readFileSync(outPath, 'utf8');
            return JSON.parse(raw);
        }
        throw new Error('Fallback JSON not found');
    } catch (e: any) {
        console.error(`[parse-resume] Local Python fallback failed:`, e.message);
        throw e;
    }
}

/**
 * MAIN POST ENDPOINT
 * Handles parsing standard resumes (via Reactive Resume + Fallback) or LinkedIn profiles (Fallback only)
 */
export async function POST(request: NextRequest) {
    let reqId = uuidv4();
    let tmpDir = path.join('/tmp', 'resume_tasks', reqId);
    let filePath = path.join(tmpDir, 'resume.pdf');

    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const uploadType = formData.get('type') as string || 'resume'; // 'resume' | 'linkedin'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        // 1. Setup Request Environment
        fs.mkdirSync(tmpDir, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        let finalJson: any = null;
        let confidence = 0;

        // 2. Logic Split: LinkedIn vs Standard Resume
        if (uploadType === 'linkedin') {
            console.log(`[parse-resume] [${reqId}] Processing LinkedIn PDF (Routing direct to Python Fallback)`);
            const fallbackResult = await runPythonFallback(reqId, filePath);
            finalJson = fallbackResult;
            confidence = 0.9; // Heuristic text extraction is usually 100% accurate for LI generated PDFs
        } else {
            console.log(`[parse-resume] [${reqId}] Processing Standard Resume (Reactive Resume API + Python Fallback)`);

            // TIER 1: Reactive Resume API
            let rxSuccess = false;
            const rxApiUrl = `${process.env.REACTIVE_RESUME_HOST}/api/ai/parse-pdf`;
            const rxApiKey = process.env.REACTIVE_RESUME_API_KEY;

            if (rxApiKey && process.env.REACTIVE_RESUME_HOST) {
                try {
                    // Reactive Resume often takes base64 payload or FormData
                    // Assuming Reactive Resume accepts a multipart/form-data upload or base64 json struct.
                    // The prompt says "call POST ... with base64 PDF and REACTIVE_RESUME_API_KEY"
                    const base64Pdf = buffer.toString('base64');

                    const response = await axios.post(rxApiUrl,
                        { buffer: base64Pdf },
                        {
                            headers: {
                                'Authorization': `Bearer ${rxApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 20000 // 20s timeout
                        }
                    );

                    const rxData = response.data;

                    if (rxData && (rxData.basics || rxData.experience)) {
                        fs.writeFileSync(path.join(tmpDir, 'parsed_reactive.json'), JSON.stringify(rxData, null, 2));
                        finalJson = rxData;
                        confidence = 0.95; // Reactive success
                        rxSuccess = true;
                        console.log(`[parse-resume] [${reqId}] Reactive Resume parsed successfully.`);
                    }
                } catch (rxErr: any) {
                    console.warn(`[parse-resume] [${reqId}] Reactive Resume failed/timeout. Proceeding to fallback:`, rxErr.message);
                }
            } else {
                console.log(`[parse-resume] [${reqId}] Reactive Resume ENVs missing, skipping Tier 1.`);
            }

            // TIER 2: Python Fallback (PaddleOCR + PDFPlumber)
            if (!rxSuccess) {
                console.log(`[parse-resume] [${reqId}] Executing Python OCR/Regex Fallback...`);
                const fallbackResult = await runPythonFallback(reqId, filePath);
                // The python result provides raw text and loose heuristics.
                // Depending on upstream, if it's strictly image-ocr we give it 0.7 confidence.
                confidence = fallbackResult._meta_method === 'paddleocr' ? 0.7 : 0.85;
                finalJson = fallbackResult;
            }
        }

        // Clean output object
        if (finalJson && finalJson._meta_method) {
            delete finalJson._meta_method;
        }

        // Provide minimal PII in server console if enabled, but return fully.
        console.log(`[parse-resume] [${reqId}] Parse completed. Confidence: ${confidence}`);

        return NextResponse.json({
            success: true,
            confidence: confidence,
            resume_json: finalJson
        });

    } catch (error: any) {
        console.error(`[parse-resume] [${reqId}] Unhandled Error:`, error.message);
        return NextResponse.json(
            { error: 'Failed to fully parse resume' },
            { status: 500 }
        );
    } finally {
        // We technically shouldn't delete the tmp directory here because the requirements 
        // said "Save OCR output to files" indicating the user wants to inspect them for tests.
        // We'll leave them in /tmp/resume_tasks. 
    }
}
