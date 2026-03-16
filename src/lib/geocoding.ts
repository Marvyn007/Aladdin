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

const ENRICHMENT_CACHE = new Map<string, { points: GeoPoint[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCacheKey(company: string | null, location: string): string {
    const normalizedCompany = (company || '').toLowerCase().trim();
    const normalizedLocation = location.toLowerCase().trim();
    return `${normalizedCompany}:${normalizedLocation}`;
}

function getEnrichmentCache(key: string): GeoPoint[] | null {
    const cached = ENRICHMENT_CACHE.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.points;
    }
    return null;
}

function setEnrichmentCache(key: string, points: GeoPoint[]): void {
    ENRICHMENT_CACHE.set(key, { points, timestamp: Date.now() });
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
        if (check.rows[0]?.geo_resolved) {
            return true;
        }

        const cacheKey = getCacheKey(company ?? null, locationString);
        const cachedPoints = getEnrichmentCache(cacheKey);

        let points: GeoPoint[] | null;

        if (cachedPoints) {
            console.log(`[Geocoding] Using cached enrichment for: ${cacheKey}`);
            points = cachedPoints;
        } else {
            const jobDetails = await getJobDetails(jobId);
            points = await enrichLocation(jobDetails, locationString);

            if (points) {
                setEnrichmentCache(cacheKey, points);
            }
        }

        if (!points || points.length === 0) {
            await markAsUnresolvable(jobId, pool);
            return false;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

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
    const isCityOnly = isCityLevelLocation(locationString);
    const company = job.company || job.companyNormalized;

    if (isCityOnly && company) {
        const hqPoints = await tryCompanyHQEnrichment(company, locationString);
        if (hqPoints) {
            return hqPoints;
        }
    }

    return getCoordinatesFromAI(locationString);
}

async function tryCompanyHQEnrichment(company: string, cityLocation: string): Promise<GeoPoint[] | null> {
    const searchQueries = [
        `${company} headquarters`,
        `${company} HQ`,
        `${company} corporate headquarters`,
        `${company} main office`,
        `${company} office address`,
        `${company} ${cityLocation} office`,
        `${company} ${cityLocation} headquarters`,
        cityLocation
    ];

    for (const query of searchQueries) {
        try {
            const points = await geocodeWithMapbox(query, true);
            if (points && points.length > 0 && points[0].confidence >= 0.7) {
                return [{
                    ...points[0],
                    label: `${company} - ${points[0].label}`,
                    source: 'company-hq'
                }];
            }
        } catch (e) {
            console.log(`[Geocoding] HQ search failed for: ${query}`);
        }
    }

    return null;
}

async function geocodeWithMapbox(query: string, preferPOI: boolean = false): Promise<GeoPoint[] | null> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
        return null;
    }

    try {
        let types = 'address,poi,locality';
        if (preferPOI) {
            types = 'poi,address,locality';
        }
        
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=3&types=${types}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            // Prefer address or poi over locality
            const feature = data.features.find((f: any) => 
                preferPOI ? (f.id.startsWith('poi') || f.id.startsWith('address')) : true
            ) || data.features[0];
            
            const [lng, lat] = feature.center;
            const confidence = getConfidenceFromMapboxFeature(feature);
            
            // Determine source based on feature type
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
    
    // Highest confidence - exact address with house number
    if (id.startsWith('address') && feature.address) {
        return 0.95;
    }
    // High confidence - address without house number
    if (id.startsWith('address')) {
        return 0.85;
    }
    // High confidence - POI (company office, building)
    if (id.startsWith('poi')) {
        return 0.9;
    }
    // Medium confidence - city/town
    if (id.startsWith('locality') || id.startsWith('place')) {
        return 0.7;
    }
    // Low confidence - region/state
    if (id.startsWith('region')) {
        return 0.5;
    }
    // Very low confidence - country
    if (id.startsWith('country')) {
        return 0.3;
    }
    
    return 0.5;
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
    const lower = loc.toLowerCase();
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
  { "latitude": 12.34, "longitude": 56.78, "label": "City, Country", "confidence": 0.9 },
  ...
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
