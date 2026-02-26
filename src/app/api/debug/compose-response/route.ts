import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const composePath = searchParams.get('path');

    if (!composePath) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const safePath = path.normalize(composePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join('/', safePath, 'compose_response.json');

    try {
        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: 'File not found', path: fullPath }, { status: 404 });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(content);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[DEBUG] Failed to read compose_response.json:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
