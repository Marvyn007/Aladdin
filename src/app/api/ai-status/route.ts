import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const provider = process.env.LLM_PROVIDER || 'openai';
        const model = process.env.LLM_MODEL || 'gpt-4o-mini';

        return NextResponse.json({
            available: true,
            message: `AI is active using ${provider} (${model})`,
            providers: {
                openai: {
                    id: 'openai',
                    name: 'OpenAI',
                    health: 'HEALTHY',
                    model: model
                }
            },
            activeProvider: 'openai'
        });
    } catch (error) {
        console.error('Error getting AI status:', error);
        return NextResponse.json(
            { error: 'Failed to get AI status', available: false },
            { status: 500 }
        );
    }
}
