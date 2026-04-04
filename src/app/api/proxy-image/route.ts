import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        // Attempt to parse the URL
        new URL(targetUrl);
    } catch {
        return new NextResponse('Invalid URL parameter', { status: 400 });
    }

    try {
        // We use a simple fetch here. 
        // Setting a standard User-Agent can help bypass simple bot blockers (like Wikipedia occasionally uses).
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Many image CDNs expect these headers if they prevent hotlinking
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
        }

        const buffer = await response.arrayBuffer();

        const headers = new Headers();
        
        // Pass the actual content type, default to jpeg if missing
        headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
        // Let the browser cache the image proxy for a year since logos rarely change
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('[API Proxy Image] Error fetching:', error);
        return new NextResponse('Failed to proxy image', { status: 500 });
    }
}
