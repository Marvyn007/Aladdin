// API Route: /api/settings
// Get and update app settings

import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/db';

// GET: Get current settings
export async function GET() {
    try {
        const settings = await getSettings();
        return NextResponse.json({ settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

// PUT: Update settings
export async function PUT(request: NextRequest) {
    try {
        const { freshLimit } = await request.json();

        if (freshLimit !== undefined) {
            // Validate range
            const clampedLimit = Math.min(Math.max(freshLimit, 100), 500);
            await updateSettings(clampedLimit);
        }

        const settings = await getSettings();
        return NextResponse.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
