
import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { resolveLocation } from '@/lib/geocoding';
import { auth } from '@clerk/nextjs/server';

// GET: Fast, read-only map data (resolved jobs only)
export async function GET(req: NextRequest) {
    try {
        const pool = getPostgresPool();
        const { searchParams } = new URL(req.url);
        const { userId } = await auth();

        let queryText = `
            SELECT DISTINCT ON (j.id)
                p.latitude, 
                p.longitude, 
                p.id as point_id,
                j.id as job_id, 
                j.title, 
                j.company, 
                j.source_url as "sourceUrl", 
                j.posted_at as "postedAt",
                j.status,
                j.location as raw_location_text,
                p.location_label as location,
                p.confidence as location_confidence,
                j.location_raw,
                COALESCE(j.geo_source, 'unknown') as location_source,
                c.logo_url as "companyLogo"
        `;

        // Add saved status if user is authenticated
        if (userId) {
            queryText += `,
                CASE WHEN uj.id IS NOT NULL THEN true ELSE false END as saved
            `;
        } else {
            queryText += `,
                false as saved
            `;
        }

        queryText += `
            FROM job_geo_points p
            JOIN jobs j ON p.job_id = j.id
            LEFT JOIN companies c ON c.name = j.company_normalized OR c.name = j.company
        `;

        // Left join for saved status (must come before other joins for DISTINCT ON)
        if (userId) {
            queryText += `
                LEFT JOIN user_jobs uj ON uj.job_id = j.id AND uj.user_id = $1
            `;
        }

        const conditions: string[] = [];
        const values: (string | number)[] = [];
        let paramCount = userId ? 2 : 1;

        if (userId) {
            values.push(userId);
        }

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

        // Transform to GeoJSON with all required properties per spec
        const features = rows.map((row, index) => ({
            type: 'Feature',
            id: index,
            geometry: {
                type: 'Point',
                coordinates: [row.longitude, row.latitude]
            },
            properties: {
                jobId: row.job_id,
                pointId: row.point_id,
                title: row.title,
                company: row.company,
                companyLogo: row.companyLogo || null,
                location: row.location,
                rawLocationText: row.location_raw || row.raw_location_text || row.location,
                postedAt: row.postedAt,
                sourceUrl: row.sourceUrl,
                status: row.status,
                saved: row.saved || false,
                locationConfidence: row.location_confidence ?? 0.5,
                locationSource: row.location_source || 'unknown'
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
export async function POST(_req: NextRequest) {
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
