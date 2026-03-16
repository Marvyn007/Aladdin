import { NextResponse } from 'next/server';

export async function POST() {
    try {
        console.log('[AI Reset] Reset requested. Using OpenAI (stateless).');

        return NextResponse.json({
            success: true,
            message: 'AI configuration is stable (OpenAI)',
            available: true,
            activeProvider: 'openai'
        });
    } catch (error) {
        console.error('Error resetting AI states:', error);
        return NextResponse.json(
            { error: 'Failed to reset AI states' },
            { status: 500 }
        );
    }
}
