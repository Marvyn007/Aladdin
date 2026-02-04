
import { routeAICall } from './ai-router';
import { getPostgresPool } from './postgres';
import { getDbType } from './db';

interface GeoPoint {
    latitude: number;
    longitude: number;
    label: string;
    confidence: number;
}

export async function resolveLocation(jobId: string, locationString: string): Promise<boolean> {
    // Only Postgres for now
    const dbType = getDbType();
    if (dbType !== 'postgres') {
        return false; // SQLite not supported for advanced geo
    }

    const pool = getPostgresPool();

    try {
        if (!locationString || locationString.trim() === '') {
            await markAsUnresolvable(jobId, pool);
            return false;
        }

        // 1. Check for Remote (Skip)
        if (isRemoteLocation(locationString)) {
            await pool.query(
                `UPDATE jobs SET geo_resolved = true, geo_source = 'rule_remote' WHERE id = $1`,
                [jobId]
            );
            return true;
        }

        // 2. Check Idempotency (Skip if resolved)
        const check = await pool.query('SELECT geo_resolved FROM jobs WHERE id = $1', [jobId]);
        if (check.rows[0]?.geo_resolved) {
            return true;
        }

        // 3. AI Geocoding (Multi-Point)
        const points = await getCoordinatesFromAI(locationString);

        if (!points || points.length === 0) {
            await markAsUnresolvable(jobId, pool);
            return false;
        }

        // 4. Update DB (Insert Points + Mark Resolved)
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert all points
            for (const pt of points) {
                await client.query(
                    `INSERT INTO job_geo_points (job_id, location_label, latitude, longitude, confidence) 
                 VALUES ($1, $2, $3, $4, $5)`,
                    [jobId, pt.label, pt.latitude, pt.longitude, pt.confidence]
                );
            }

            // Mark job as resolved
            await client.query(
                `UPDATE jobs SET 
             geo_resolved = true, 
             geo_source = 'ai_multi',
             geo_confidence = $2
             WHERE id = $1`,
                [jobId, points[0].confidence]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return true;

    } catch (error) {
        console.error(`[Geocoding] Error resolving ${jobId} (${locationString}):`, error);
        return false;
    }
}

async function markAsUnresolvable(jobId: string, pool: any) {
    await pool.query(`UPDATE jobs SET geo_resolved = true, geo_source = 'failed', geo_confidence = 0.0 WHERE id = $1`, [jobId]);
}

function isRemoteLocation(loc: string): boolean {
    const lower = loc.toLowerCase();
    return lower.includes('remote') || lower.includes('virtual') || lower.includes('home based') || lower === 'anywhere';
}

async function getCoordinatesFromAI(location: string): Promise<GeoPoint[] | null> {
    const prompt = `
    I need to geocode this job location string into distinct physical coordinates.
    Location: "${location}"

    Rules:
    1. If MULTIPLE locations (e.g. "NY and SF"), return distinct points for EACH.
    2. If COUNTRY ONLY (e.g. "China", "UK"), return the CAPITAL CITY coordinates.
    3. If CITY (e.g. "Austin, TX"), return City Centroid.
    4. If REMOTE, return empty array [].
    5. Return ONLY a valid JSON array of objects.
    
    Format:
    [
      { "latitude": 12.34, "longitude": 56.78, "label": "City, Country", "confidence": 0.9 },
      ...
    ]
  `;

    try {
        const responseText = await routeAICall(prompt);
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJson);

        if (Array.isArray(data) && data.length > 0) {
            return data.filter(d => typeof d.latitude === 'number' && typeof d.longitude === 'number');
        }
        return null;
    } catch (e) {
        console.error('[Geocoding] AI parsing failed for:', location, e);
        return null;
    }
}
