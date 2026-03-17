
import { callLLM, safeJsonParse } from './resume-generation/utils';
import { getPostgresPool } from './postgres';
import { getDbType } from './db';

export interface GeoPoint {
    latitude: number;
    longitude: number;
    label: string;
    confidence: number;
    source: string;
}

interface JobDetails {
    id: string;
    location: string | null;
    company: string | null;
    companyNormalized: string | null;
}

async function getEnrichmentCache(key: string): Promise<GeoPoint[] | null> {
    const pool = getPostgresPool();
    try {
        const result = await pool.query(
            `SELECT jgp.location_label as label, jgp.latitude, jgp.longitude, jgp.confidence, jgp.source 
             FROM job_geo_points jgp
             JOIN jobs j ON jgp.job_id = j.id
             WHERE j.location_dedup_key = $1
             LIMIT 5`,
            [key]
        );
        
        if (result.rows.length > 0) {
            return result.rows.map(r => ({
                latitude: Number(r.latitude),
                longitude: Number(r.longitude),
                label: r.label,
                confidence: Number(r.confidence),
                source: r.source
            }));
        }
    } catch (e) {
        console.error('[Geocoding] Cache lookup failed:', e);
    }
    return null;
}

function getCacheKey(company: string | null, location: string): string {
    const normalizedCompany = (company || 'unknown').toLowerCase().trim();
    const normalizedLocation = location.toLowerCase().trim();
    return `${normalizedCompany}:${normalizedLocation}`;
}

export async function resolveLocation(jobId: string, locationString: string, company?: string | null): Promise<boolean> {
    const dbType = getDbType();
    if (dbType !== 'postgres') {
        return false;
    }

    const pool = getPostgresPool();

    try {
        if (!locationString || locationString.trim() === '') {
            await markAsUnresolvable(jobId, pool);
            return false;
        }

        if (isRemoteLocation(locationString)) {
            await pool.query(
                `UPDATE jobs SET geo_resolved = true, geo_source = 'rule_remote', location_raw = $2 WHERE id = $1`,
                [jobId, locationString]
            );
            return true;
        }

        const check = await pool.query('SELECT geo_resolved, location_dedup_key FROM jobs WHERE id = $1', [jobId]);
        
        const cacheKey = getCacheKey(company ?? null, locationString);
        const cachedPoints = await getEnrichmentCache(cacheKey);

        let points: GeoPoint[] | null;

        if (cachedPoints) {
            console.log(`[Geocoding] Using persistent cache for: ${cacheKey}`);
            points = cachedPoints;
        } else {
            const jobDetails = await getJobDetails(jobId);
            // Ensure we use the passed company if available, fallback to DB
            jobDetails.company = company || jobDetails.company; 
            
            points = await enrichLocation(jobDetails, locationString);
        }

        if (!points || points.length === 0) {
            await markAsUnresolvable(jobId, pool);
            return false;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Clear any existing points for this job before inserting new ones
            await client.query('DELETE FROM job_geo_points WHERE job_id = $1', [jobId]);

            for (const pt of points) {
                await client.query(
                    `INSERT INTO job_geo_points (job_id, location_label, latitude, longitude, confidence, source, raw_location_text) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [jobId, pt.label, pt.latitude, pt.longitude, pt.confidence, pt.source, locationString]
                );
            }

            await client.query(
                `UPDATE jobs SET 
             geo_resolved = true, 
             geo_source = $2,
             geo_confidence = $3,
             location_raw = $4,
             geocoded_at = NOW(),
             location_dedup_key = $5
             WHERE id = $1`,
                [jobId, points[0].source, points[0].confidence, locationString, cacheKey]
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

async function getJobDetails(jobId: string): Promise<JobDetails> {
    const pool = getPostgresPool();
    const result = await pool.query(
        'SELECT id, location, company, company_normalized FROM jobs WHERE id = $1',
        [jobId]
    );
    return result.rows[0] || { id: jobId, location: null, company: null, companyNormalized: null };
}

async function enrichLocation(job: JobDetails, locationString: string): Promise<GeoPoint[] | null> {
    if (isRemoteLocation(locationString)) return null;
    
    // First, geocode the city level location to get a centroid for proximity biasing
    // Use strictly place/locality to avoid getting random addresses in other countries
    const cityCentroid = await geocodeWithMapbox(locationString, false, undefined, 'place,locality');
    const proximity = cityCentroid && cityCentroid.length > 0 
        ? { lat: cityCentroid[0].latitude, lng: cityCentroid[0].longitude } 
        : undefined;

    const isCityOnly = isCityLevelLocation(locationString);
    const company = job.company || job.companyNormalized;

    if (company) {
        const hqPoints = await tryCompanyHQEnrichment(company, locationString, proximity);
        if (hqPoints) {
            return hqPoints;
        }
    }

    return getCoordinatesFromAI(locationString);
}

async function tryCompanyHQEnrichment(company: string, cityLocation: string, proximity?: { lat: number, lng: number }): Promise<GeoPoint[] | null> {
    const searchQueries = [
        `${company} headquarters`, 
        `${company} ${cityLocation}`,
        `${company} office`,
        `${company} HQ`
    ];

    for (const query of searchQueries) {
        try {
            const points = await geocodeWithMapbox(query, true, proximity);
            if (points && points.length > 0 && points[0].confidence >= 0.6) {
                // Verification: Is this result actually in the right place?
                const labelLower = points[0].label.toLowerCase();
                const cityParts = cityLocation.split(',').map(s => s.toLowerCase().trim());
                const primaryCity = cityParts[0];
                
                // Distance Guard: If we have a proximity target, don't stray too far (e.g. 100km)
                if (proximity) {
                    const distance = calculateDistance(proximity.lat, proximity.lng, points[0].latitude, points[0].longitude);
                    if (distance > 100) {
                        console.log(`[Geocoding] Rejecting ${points[0].label} - Too far from ${cityLocation} (${distance.toFixed(1)}km)`);
                        continue;
                    }
                }

                // Context Validation: Check if the label mentions the city or company
                const isCityMatch = cityParts.some(part => labelLower.includes(part));
                const isCompanyMatch = labelLower.includes(company.toLowerCase());

                if (isCityMatch || isCompanyMatch) {
                    return [{
                        ...points[0],
                        label: `${company} - ${points[0].label}`,
                        source: 'company-hq'
                    }];
                }
            }
        } catch (e) {
            console.log(`[Geocoding] HQ search failed for: ${query}`);
        }
    }

    return null;
}

async function geocodeWithMapbox(query: string, preferPOI: boolean = false, proximity?: { lat: number, lng: number }, typesOverride?: string): Promise<GeoPoint[] | null> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
        return null;
    }

    try {
        let types = typesOverride || 'address,poi,locality';
        if (!typesOverride && preferPOI) {
            types = 'poi,address,locality';
        }
        
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=3&types=${types}`;
        
        if (proximity) {
            url += `&proximity=${proximity.lng},${proximity.lat}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const feature = data.features.find((f: any) => 
                preferPOI ? (f.id.startsWith('poi') || f.id.startsWith('address')) : true
            ) || data.features[0];
            
            const [lng, lat] = feature.center;
            const confidence = getConfidenceFromMapboxFeature(feature);
            
            let source = 'city-centroid';
            if (feature.id.startsWith('poi')) {
                source = 'company-hq';
            } else if (feature.id.startsWith('address')) {
                source = 'geocoded-address';
            } else if (feature.id.startsWith('locality') || feature.id.startsWith('place')) {
                source = 'city-centroid';
            }

            return [{
                latitude: lat,
                longitude: lng,
                label: feature.place_name,
                confidence,
                source
            }];
        }
    } catch (e) {
        console.error('[Geocoding] Mapbox API error:', e);
    }

    return null;
}

function getConfidenceFromMapboxFeature(feature: any): number {
    const id = feature.id || '';
    if (id.startsWith('address') && feature.address) return 0.95;
    if (id.startsWith('address')) return 0.85;
    if (id.startsWith('poi')) return 0.9;
    if (id.startsWith('locality') || id.startsWith('place')) return 0.7;
    if (id.startsWith('region')) return 0.5;
    if (id.startsWith('country')) return 0.3;
    return 0.5;
}

/**
 * Haversine formula to calculate distance between two points in KM
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function isCityLevelLocation(loc: string): boolean {
    const lower = loc.toLowerCase();
    const cityIndicators = [',', 'city', ' area'];
    return cityIndicators.some(ind => lower.includes(ind)) ||
           /^[a-z\s]+,\s*[a-z]{2}$/i.test(loc) ||
           /^[a-z\s]+$/i.test(loc);
}

async function markAsUnresolvable(jobId: string, pool: any) {
    await pool.query(`UPDATE jobs SET geo_resolved = true, geo_source = 'failed', geo_confidence = 0.0 WHERE id = $1`, [jobId]);
}

function isRemoteLocation(loc: string): boolean {
    const lower = (loc || '').toLowerCase();
    return lower.includes('remote') || lower.includes('virtual') || lower.includes('home based') || lower === 'anywhere' || lower.includes('work from home');
}

async function getCoordinatesFromAI(location: string): Promise<GeoPoint[] | null> {
    const systemPrompt = `You are a specialized geocoding AI.
Extract physical coordinates (latitude, longitude) for job locations.

Rules:
 1. If MULTIPLE locations (e.g. "NY and SF"), return distinct points for EACH.
 2. If COUNTRY ONLY (e.g. "China", "UK"), return the CAPITAL CITY coordinates.
 3. If CITY (e.g. "Austin, TX"), return City Centroid.
 4. If REMOTE, return an empty array [].
 5. Output ONLY a valid JSON array of objects.

Example Format:
[
  { "latitude": 12.34, "longitude": 56.78, "label": "City, Country", "confidence": 0.9 }
]`;

    const userPrompt = `Geocode this location: "${location}"`;

    try {
        const responseText = await callLLM([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], {
            jsonMode: true,
            temperature: 0
        });

        const data = safeJsonParse<GeoPoint[]>(responseText);

        if (Array.isArray(data) && data.length > 0) {
            return data
                .filter(d => typeof d.latitude === 'number' && typeof d.longitude === 'number')
                .map(d => ({
                    ...d,
                    source: d.source || 'city-centroid'
                }));
        }
        return null;
    } catch (e) {
        console.error('[Geocoding] AI parsing failed for:', location, e);
        return null;
    }
}
