import * as fs from 'fs';
import * as path from 'path';

const BASE_DIR = '/tmp/resume_tasks';

export function ensureDir(reqId: string): string {
    const dir = path.join(BASE_DIR, reqId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function saveLLMOutput(
    reqId: string | undefined,
    stage: 'bullet' | 'compose',
    data: {
        bulletIndex?: number;
        rawResponse?: string;
        parsedJson?: any;
        success: boolean;
        error?: string;
    }
): void {
    if (!reqId) return;

    const dir = ensureDir(reqId);

    try {
        if (stage === 'bullet' && data.bulletIndex !== undefined) {
            const filePath = path.join(dir, `bullet_${data.bulletIndex}.json`);
            const payload = {
                raw_response: data.rawResponse,
                parsed_json: data.parsedJson,
                success: data.success,
                error: data.error,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            console.log(`[SAVE LLM] Bullet ${data.bulletIndex} saved to ${filePath}`);
        } 
        else if (stage === 'compose') {
            const filePath = path.join(dir, 'compose_response.json');
            const payload = {
                raw_response: data.rawResponse,
                parsed_json: data.parsedJson,
                success: data.success,
                error: data.error,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            console.log(`[SAVE LLM] Compose response saved to ${filePath}`);
        }
    } catch (e: any) {
        console.error(`[SAVE LLM ERROR] Failed to save ${stage}: ${e.message}`);
    }
}

export function saveRawFailedOutput(
    reqId: string | undefined,
    stage: string,
    rawOutput: string,
    error?: string
): void {
    if (!reqId) return;

    const dir = ensureDir(reqId);
    const filePath = path.join(dir, `raw_failed_${stage}.txt`);

    try {
        const content = `ERROR: ${error || 'Unknown error'}\n\nRAW OUTPUT:\n${rawOutput}`;
        fs.writeFileSync(filePath, content);
        console.log(`[SAVE RAW FAILED] Saved failed output to ${filePath}`);
    } catch (e: any) {
        console.error(`[SAVE RAW FAILED ERROR] ${e.message}`);
    }
}

export function saveBulletJson(
    reqId: string | undefined,
    bulletIndex: number,
    data: any
): void {
    if (!reqId) return;

    const dir = ensureDir(reqId);
    const filePath = path.join(dir, `bullet_${bulletIndex}.json`);

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`[SAVE BULLET JSON] Saved to ${filePath}`);
    } catch (e: any) {
        console.error(`[SAVE BULLET JSON ERROR] ${e.message}`);
    }
}
