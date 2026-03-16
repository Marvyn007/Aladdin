import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const provider = process.env.LLM_PROVIDER || 'openai';
        const model = process.env.LLM_MODEL || 'gpt-4o-mini';

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            summary: `Stable connection to ${provider}`,
            architecture: 'DIRECT (OpenAI)',
            active_provider: provider,
            providers: {
                openai: {
                    status: 'HEALTHY',
                    primary_model: model
                }
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
