
import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { resolveLocation } from '@/lib/geocoding';

// GET: Fast, read-only map data (resolved jobs only)
export async function GET(req: NextRequest) {
    try {
        const pool = getPostgresPool();
        const { searchParams } = new URL(req.url);

        let queryText = `
            SELECT 
                p.latitude, 
                p.longitude, 
                p.id as point_id,
                j.id as job_id, 
                j.title, 
                j.company, 
                j.source_url as "sourceUrl", 
                j.posted_at as "postedAt",
                j.status,
                p.location_label as location
            FROM job_geo_points p
            JOIN jobs j ON p.job_id = j.id
        `;

        const conditions: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (searchParams.has('minLat')) {
            conditions.push(`p.latitude >= $${paramCount++}`);
            values.push(parseFloat(searchParams.get('minLat')!));

            conditions.push(`p.latitude <= $${paramCount++}`);
            values.push(parseFloat(searchParams.get('maxLat')!));

            conditions.push(`p.longitude >= $${paramCount++}`);
            values.push(parseFloat(searchParams.get('minLng')!));

            conditions.push(`p.longitude <= $${paramCount++}`);
            values.push(parseFloat(searchParams.get('maxLng')!));
        }

        if (conditions.length > 0) {
            queryText += ` WHERE ${conditions.join(' AND ')}`;
        }

        queryText += ` LIMIT 5000`;

        const { rows } = await pool.query(queryText, values);

        // Transform to GeoJSON
        const features = rows.map(row => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [row.longitude, row.latitude]
            },
            properties: {
                id: row.job_id,
                point_id: row.point_id,
                title: row.title,
                company: row.company,
                location: row.location,
                postedAt: row.postedAt,
                sourceUrl: row.sourceUrl,
                status: row.status
            }
        }));

        return NextResponse.json({
            type: 'FeatureCollection',
            features
        });

    } catch (error) {
        console.error('[GeoAPI] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Trigger background resolution for unresolved jobs
export async function POST(req: NextRequest) {
    triggerBackgroundGeocoding();
    return NextResponse.json({ success: true, message: 'Geocoding triggered' });
}

// Fire and forget - resolve a batch of unresolved jobs
async function triggerBackgroundGeocoding() {
    const pool = getPostgresPool();
    try {
        // Find unresolved jobs with valid location
        // Excluding failed attempts to avoid loops
        const { rows: unresolvedJobs } = await pool.query(`
        SELECT id, location 
        FROM jobs 
        WHERE geo_resolved = false 
          AND location IS NOT NULL 
          AND location != ''
          AND (geo_source IS NULL OR geo_source != 'failed')
        ORDER BY posted_at DESC 
        LIMIT 10
    `);

        if (unresolvedJobs.length > 0) {
            console.log(`[GeoBG] Processing batch of ${unresolvedJobs.length} jobs`);
            for (const job of unresolvedJobs) {
                if (job.location) {
                    await resolveLocation(job.id, job.location);
                }
            }
        }
    } catch (e) {
        console.error('Trigger BG Geocoding failed', e);
    }
}
