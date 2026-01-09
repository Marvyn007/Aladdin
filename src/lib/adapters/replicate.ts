
export interface ReplicateResponse {
    output: string[];
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    error?: string;
}

const DEFAULT_MODEL_VERSION = ''; // Prompt implies using model name, but API often needs version or 'owner/name'
// Use meta/meta-llama-3-8b-instruct or similar
const DEFAULT_MODEL = 'meta/meta-llama-3-8b-instruct';
const TIMEOUT_MS = 15000;
const POLLING_INTERVAL_MS = 1000;

export async function callReplicate(prompt: string): Promise<string> {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
        throw new Error('Replicate API token not configured');
    }

    const model = process.env.REPLICATE_MODEL || DEFAULT_MODEL;

    // 1. Start Prediction
    const startUrl = `https://api.replicate.com/v1/permissions?` // No, it's models/{owner}/{name}/predictions or just /predictions with version
    // Safest is /predictions with "version" if known, or "model" (owner/name) in body if supported by new API?
    // Replicate API now supports `model` field in body for some endpoints but standardized is `POST /predictions` with `version`.
    // However, looking up version for "latest" requires another call.
    // Better: Use `POST https://api.replicate.com/v1/models/{owner}/{name}/predictions`

    const [owner, name] = model.split('/');
    if (!owner || !name) throw new Error(`Invalid Replicate model string: ${model}`);

    const url = `https://api.replicate.com/v1/models/${owner}/${name}/predictions`;

    const controller = new AbortController();
    const globalTimeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        console.log(`[Replicate] Starting prediction for ${model}`);

        const startRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait' // Try to wait for sync result if possible (max 60s provided by API, but we limit to 15s)
            },
            body: JSON.stringify({
                input: {
                    prompt: prompt,
                    max_new_tokens: 256,
                    temperature: 0.7
                }
            }),
            signal: controller.signal
        });

        if (!startRes.ok) {
            const err = await startRes.text();
            if (startRes.status === 429) throw new Error('Replicate Rate Limit (429)');
            if (startRes.status === 402) throw new Error('Replicate Billing Error (402)');
            throw new Error(`Replicate Start Failed (${startRes.status}): ${err}`);
        }

        let prediction = await startRes.json();

        // If 'Prefer: wait' worked and it's done:
        if (prediction.status === 'succeeded') {
            clearTimeout(globalTimeout);
            return prediction.output.join('');
        }

        // Otherwise Poll
        const getUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;

        while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
            if (controller.signal.aborted) throw new Error('Replicate timeout');

            await new Promise(r => setTimeout(r, POLLING_INTERVAL_MS));

            console.log(`[Replicate] Polling ${prediction.id} (${prediction.status})...`);
            const pollRes = await fetch(getUrl, {
                headers: { 'Authorization': `Bearer ${apiToken}` },
                signal: controller.signal
            });

            if (!pollRes.ok) throw new Error('Replicate Polling Failed');
            prediction = await pollRes.json();
        }

        clearTimeout(globalTimeout);

        if (prediction.status === 'failed') {
            throw new Error(`Replicate processing failed: ${prediction.error}`);
        }

        return prediction.output ? prediction.output.join('') : '';

    } catch (error: any) {
        clearTimeout(globalTimeout);
        if (error.name === 'AbortError') throw new Error(`Replicate timeout (${TIMEOUT_MS}ms)`);
        throw error;
    }
}
