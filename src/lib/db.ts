// Database abstraction layer - supports both Supabase and SQLite
// Automatically selects the appropriate backend based on configuration

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { getSQLiteDB, isSQLiteConfigured, archiveOldJobs as sqliteArchive, purgeOldArchives as sqlitePurge } from './sqlite';
import { getPostgresPool, isPostgresConfigured, executeWithUser } from './postgres';
import { checkRequiredEnv } from './check-env';
import type {
    Job,
    Resume,
    LinkedInProfile,
    Application,
    CoverLetter,
    ApplicationColumn,
    ParsedResume,
    JobStatus
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { getS3Client, uploadFileToS3, getSignedDownloadUrl, deleteFileFromS3, generateS3Key } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { encodeThemeMode, decodeThemeMode, encodeColorPalette, decodeColorPalette } from '@/lib/themes';

// Fail-fast check on module load (will run when server starts)
checkRequiredEnv();

// Determine which database to use
// Determine which database to use
export type DatabaseType = 'postgres' | 'supabase' | 'sqlite';

export function getDbType(): DatabaseType {
    // Explicit override for restricted networks (firewall blocking port 5432)
    if (process.env.USE_SUPABASE_REST === 'true' && isSupabaseConfigured()) {
        console.log('[DB] Using Supabase REST (USE_SUPABASE_REST=true)');
        return 'supabase';
    }

    if (isPostgresConfigured()) {
        // console.log('[DB] Using Postgres'); // Noisy, uncomment if needed
        return 'postgres';
    }

    // Force strict Neon usage requested by user
    /*
    if (isSupabaseConfigured()) {
        console.log('[DB] Using Supabase (Fallback)');
        return 'supabase';
    }
    if (isSQLiteConfigured()) {
        console.log('[DB] Using SQLite');
        return 'sqlite';
    }
    */

    console.error('[DB] FATAL: Neon (Postgres) is not configured! DATABASE_URL is missing.');
    throw new Error('No database configured. Set DATABASE_URL, SUPABASE_URL/KEY, or USE_SQLITE=true');
}

// Generate content hash for deduplication
export function generateContentHash(title: string, company: string | null, location: string | null, text: string): string {
    const normalized = `${title}|${company || ''}|${location || ''}|${text}`.toLowerCase().trim();
    return CryptoJS.SHA256(normalized).toString();
}

import { weightedAverage } from '@/lib/vector-math';

// ============================================================================
// USER PREFERENCE LEARNING
// ============================================================================

/**
 * Update user's preference embedding based on interaction
 * Uses a moving average to drift the user's profile towards the job's embedding
 */
export async function updateUserEmbedding(userId: string, jobId: string, type: string) {
    const dbType = getDbType();
    if (dbType !== 'postgres') return; // Vector ops only on Postgres for now

    // Weights for different interactions
    const WEIGHTS: Record<string, number> = {
        'view': 0.02,   // Slow drift
        'save': 0.10,   // Moderate drift
        'apply': 0.20,  // Strong drift
    };

    const weight = WEIGHTS[type] || 0.01;

    try {
        await executeWithUser(userId, async (client) => {
            // 1. Get Job Embedding and Current User Embedding
            const res = await client.query(`
                SELECT 
                    je.embedding as job_vec,
                    u.preference_embedding as user_vec
                FROM job_embeddings je
                LEFT JOIN users u ON u.id = $1
                WHERE je.job_id = $2
            `, [userId, jobId]);

            if (res.rows.length === 0 || !res.rows[0].job_vec) return;

            const jobVec = JSON.parse(res.rows[0].job_vec);
            // Default to job vec if user has no profile yet
            const currentVec = res.rows[0].user_vec ? JSON.parse(res.rows[0].user_vec) : jobVec;

            // 2. Calculate New Weighted Average
            // If it's the first interaction (no user vec), the new vec is just the job vec
            const newVec = res.rows[0].user_vec
                ? weightedAverage(currentVec, jobVec, weight)
                : jobVec;

            // 3. Update User
            await client.query(`
                UPDATE users 
                SET preference_embedding = $2::vector, updated_at = NOW()
                WHERE id = $1
            `, [userId, JSON.stringify(newVec)]);
        });
    } catch (e) {
        console.error('Failed to update user embedding:', e);
        // Fail silently to not block UI
    }
}

// ============================================================================
// JOBS OPERATIONS
// ============================================================================

/**
 * Get ALL public jobs with pagination (no user filtering)
 * Stable ordering: fetched_at DESC, id for consistent pagination
 */
/**
 * Get ALL public jobs with pagination (no user filtering)
 * Stable ordering: Primary Sort -> ID (tie-breaker)
 */
export async function getAllPublicJobs(
    page: number = 1,
    limit: number = 50,
    sortBy: 'time' | 'imported' | 'score' = 'time',
    sortDir: 'asc' | 'desc' = 'desc',
    currentUserId: string | null = null
): Promise<Job[]> {
    const dbType = getDbType();
    const offset = (page - 1) * limit;

    // Mapping
    const sortColumn = {
        'time': 'fetched_at',
        'imported': 'scraped_at',
        'score': 'created_at' // Public jobs don't have match_score usually
    }[sortBy] || 'fetched_at';

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const query = currentUserId
            ? `
            SELECT j.*, 
                   uj.poster_first_name, uj.poster_last_name, uj.poster_image_url,
                   u.votes as poster_votes,
                   u.id as poster_id,
                   viewer_uj.status as viewer_status,
                   c.logo_url as company_logo_url
            FROM jobs j
            LEFT JOIN companies c ON j.company = c.name
            LEFT JOIN user_jobs uj ON j.id = uj.job_id AND j.posted_by_user_id = uj.user_id
            LEFT JOIN users u ON j.posted_by_user_id = u.id
            LEFT JOIN user_jobs viewer_uj ON j.id = viewer_uj.job_id AND viewer_uj.user_id = $3
            ORDER BY j.${sortColumn} ${sortDir.toUpperCase()}
            LIMIT $1 OFFSET $2
            `
            : `
            SELECT j.*, 
                   uj.poster_first_name, uj.poster_last_name, uj.poster_image_url,
                   u.votes as poster_votes,
                   u.id as poster_id,
                   c.logo_url as company_logo_url
            FROM jobs j
            LEFT JOIN companies c ON j.company = c.name
            LEFT JOIN user_jobs uj ON j.id = uj.job_id AND j.posted_by_user_id = uj.user_id
            LEFT JOIN users u ON j.posted_by_user_id = u.id
            ORDER BY j.${sortColumn} ${sortDir.toUpperCase()}
            LIMIT $1 OFFSET $2
            `;

        const params = currentUserId ? [limit, offset, currentUserId] : [limit, offset];
        const res = await pool.query(query, params);

        console.log(`[DB] getAllPublicJobs: returned ${res.rows.length} rows (offset ${offset}, limit ${limit})`);

        return res.rows.map((row) => ({
            ...row,
            status: row.viewer_status || 'fresh',
            matched_skills: row.matched_skills,
            missing_skills: row.missing_skills,
            postedBy: row.poster_id ? {
                id: row.poster_id,
                firstName: row.poster_first_name || row.first_name, // Fallback to user table if snapshot missing
                lastName: row.poster_last_name || row.last_name,
                imageUrl: row.poster_image_url || row.image_url,
                votes: row.poster_votes || 0
            } : null
        })) as Job[];

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        // For Supabase, simplified approach: fetch jobs then fetch status in parallel or let the client handle it?
        // Ideally we use a similar join. Supabase JS is tricky with complex self-joins on same table with different filters.
        // We'll stick to the existing behavior for Supabase for now or add a basic post-fetch enhancement if needed.
        // Assuming Postgres is the primary target as per logs.

        const { data, error } = await client
            .from('jobs')
            .select('*, postedBy:users!jobs_posted_by_user_id_fkey(id, votes), user_jobs(user_id, poster_first_name, poster_last_name, poster_image_url)')
            .order(sortColumn, { ascending: sortDir === 'asc' })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // If currentUserId is provided, we might need a separate query to get statuses 
        // OR filtering the user_jobs result if it returns all.
        // The current select user_jobs(...) returns ALL user_jobs for that job. 
        // We can find the one matching currentUserId.

        return (data || []).map((row: any) => {
            const posterUj = row.user_jobs?.find((uj: any) => uj.user_id === row.posted_by_user_id);
            const viewerUj = currentUserId ? row.user_jobs?.find((uj: any) => uj.user_id === currentUserId) : null;

            return {
                ...row,
                status: viewerUj?.status || 'fresh', // Default to fresh if not found
                postedBy: row.postedBy ? {
                    id: row.postedBy.id,
                    firstName: posterUj?.poster_first_name || null,
                    lastName: posterUj?.poster_last_name || null,
                    imageUrl: posterUj?.poster_image_url || null,
                    votes: row.postedBy.votes || 0
                } : null
            };
        }) as Job[];

    } else {
        const db = getSQLiteDB();
        // SQLite local handling
        const rows = db.prepare(`
            SELECT * FROM jobs 
            ORDER BY ${sortColumn} ${sortDir.toUpperCase()}, id ASC
            LIMIT ? OFFSET ?
        `).all(limit, offset) as Record<string, unknown>[];

        return rows.map((row) => ({
            ...row,
            matched_skills: row.matched_skills ? JSON.parse(row.matched_skills as string) : null,
            missing_skills: row.missing_skills ? JSON.parse(row.missing_skills as string) : null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: row.extraction_confidence ? JSON.parse(row.extraction_confidence as string) : null,
            postedBy: null // SQLite local
        })) as Job[];
    }
}

/**
 * Get jobs filtered by user status
 */
export async function getJobs(
    userId: string,
    status: JobStatus = 'fresh',
    page: number = 1,
    limit: number = 50,
    sortBy: 'time' | 'imported' | 'score' | 'relevance' = 'time',
    sortDir: 'asc' | 'desc' = 'desc'
): Promise<Job[]> {
    const offset = (page - 1) * limit;
    const dbType = getDbType();

    // Mapping for sort columns
    // We default to created_at for time
    const sortColumn = {
        'time': 'created_at',
        'imported': 'scraped_at',
        'score': 'match_score',
        'relevance': 'match_score'
    }[sortBy] || 'created_at';

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query(`
            SELECT j.*, 
                   uj.status, 
                   uj.match_score, 
                   uj.matched_skills, 
                   uj.missing_skills, 
                   uj.why, 
                   uj.archived_at,
                   poster_uj.poster_first_name, poster_uj.poster_last_name, poster_uj.poster_image_url,
                   u.id as poster_id, u.votes as poster_votes,
                   c.logo_url as company_logo_url
            FROM jobs j
            LEFT JOIN companies c ON j.company = c.name
            JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = $1
            LEFT JOIN user_jobs poster_uj ON j.id = poster_uj.job_id AND j.posted_by_user_id = poster_uj.user_id
            LEFT JOIN users u ON j.posted_by_user_id = u.id
            WHERE (uj.status = $2 OR (uj.status IS NULL AND $2 = 'fresh'))
            ORDER BY ${(sortBy === 'score' || sortBy === 'relevance') ? 'uj.match_score' : 'j.' + sortColumn} ${sortDir.toUpperCase()}
            LIMIT $3 OFFSET $4
        `, [userId, status, limit, offset]);

        return res.rows.map((row) => ({
            ...row,
            matched_skills: row.matched_skills, // Postgres driver parses JSON automatically
            missing_skills: row.missing_skills,
            postedBy: row.poster_id ? {
                id: row.poster_id,
                firstName: row.poster_first_name,
                lastName: row.poster_last_name,
                imageUrl: row.poster_image_url,
                votes: row.poster_votes || 0
            } : null
        })) as Job[];

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        let query = client.from('jobs')
            .select(`
                *,
                user_jobs!inner (
                    status, match_score, matched_skills, missing_skills, why, archived_at
                ),
                postedBy:users!jobs_posted_by_user_id_fkey(
                    id, votes
                ),
                poster_uj:user_jobs(user_id, poster_first_name, poster_last_name, poster_image_url)
            `)
            .eq('user_jobs.user_id', userId)
            .eq('user_jobs.status', status)
            .range(offset, offset + limit - 1);

        if (sortBy === 'score' || sortBy === 'relevance') {
            query = query.order('match_score', { foreignTable: 'user_jobs', ascending: sortDir === 'asc' });
        } else {
            query = query.order(sortColumn, { ascending: sortDir === 'asc' });
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((row: any) => {
            const posterUj = row.poster_uj?.find((uj: any) => uj.user_id === row.posted_by_user_id);
            return {
                ...row,
                ...row.user_jobs[0], // Flatten user_jobs props (the one for current user)
                postedBy: row.postedBy ? {
                    id: row.postedBy.id,
                    firstName: posterUj?.poster_first_name || null,
                    lastName: posterUj?.poster_last_name || null,
                    imageUrl: posterUj?.poster_image_url || null,
                    votes: row.postedBy.votes || 0
                } : null
            };
        }) as Job[];

    } else {
        const db = getSQLiteDB();
        // Simplified SQLite query - might need adjustment for JOINs if strictly needed but usually local doesn't have users table fully populated same way
        const rows = db.prepare(`
            SELECT j.*, uj.status, uj.match_score, uj.matched_skills, uj.missing_skills, uj.why, uj.archived_at
            FROM jobs j
            JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = ?
            WHERE (uj.status = ? OR (uj.status IS NULL AND ? = 'fresh'))
            ORDER BY ${(sortBy === 'score' || sortBy === 'relevance') ? 'uj.match_score' : 'j.' + sortColumn} ${sortDir.toUpperCase()}
            LIMIT ? OFFSET ?
        `).all(userId, status, status, limit, offset) as Record<string, unknown>[];

        return rows.map((row) => ({
            ...row,
            matched_skills: row.matched_skills ? JSON.parse(row.matched_skills as string) : null,
            missing_skills: row.missing_skills ? JSON.parse(row.missing_skills as string) : null,
            postedBy: null // SQLite mostly local, might not have separate user records
        })) as Job[];
    }
}

/**
 * Get total count of public jobs for pagination
 */
export async function getTotalPublicJobsCount(): Promise<number> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query('SELECT COUNT(*) as count FROM jobs');
        return parseInt(res.rows[0].count, 10);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { count, error } = await client
            .from('jobs')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        return count || 0;
    } else {
        const db = getSQLiteDB();
        const result = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
        return result.count;
    }
}

/**
 * Get the timestamp of the most recently ingested job
 */
export async function getLastJobIngestionTime(): Promise<string | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        // Check fetched_at (indexed) instead of unscraped_at (unindexed)
        const res = await pool.query('SELECT MAX(fetched_at) as last_updated FROM jobs');
        return res.rows[0]?.last_updated ? new Date(res.rows[0].last_updated).toISOString() : null;
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .select('fetched_at')
            .order('fetched_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null; // Safe fail
        return data?.fetched_at || null;
    } else {
        const db = getSQLiteDB();
        const result = db.prepare('SELECT MAX(fetched_at) as last_updated FROM jobs').get() as { last_updated: string };
        return result?.last_updated || null;
    }
}

/**
 * Get total count of user jobs for pagination
 */
export async function getTotalUserJobsCount(userId: string, status: JobStatus = 'fresh'): Promise<number> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                SELECT COUNT(*) as count 
                FROM jobs j
                LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = $1
                WHERE (uj.status = $2 OR (uj.status IS NULL AND $2 = 'fresh'))
            `, [userId, status]);
            return parseInt(res.rows[0].count, 10);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { count, error } = await client
            .from('user_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', status);

        if (error) throw error;
        return count || 0;
    } else {
        const db = getSQLiteDB();
        const result = db.prepare('SELECT COUNT(*) as count FROM user_jobs WHERE user_id = ? AND status = ?').get(userId, status) as { count: number };
        return result.count;
    }
}

export async function getJobById(userId: string | null, id: string): Promise<Job | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        let query = 'SELECT j.*, c.logo_url as company_logo_url FROM jobs j LEFT JOIN companies c ON j.company = c.name WHERE j.id = $1';
        let params: any[] = [id];

        if (userId) {
            query = `
                SELECT j.*, 
                       COALESCE(uj.status, 'fresh') as status, 
                       COALESCE(uj.match_score, 0) as match_score, 
                       uj.matched_skills, 
                       uj.missing_skills, 
                       uj.why, 
                       uj.archived_at,
                       c.logo_url as company_logo_url
                FROM jobs j
                LEFT JOIN companies c ON j.company = c.name
                LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = $2
                WHERE j.id = $1
            `;
            params = [id, userId];

            return executeWithUser(userId, async (client) => {
                const res = await client.query(query, params);
                if (res.rows.length === 0) return null;

                const row = res.rows[0];
                return {
                    ...row,
                    matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills,
                    missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills,
                    isImported: Boolean(row.is_imported),
                    date_posted_relative: Boolean(row.date_posted_relative),
                    extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
                } as Job;
            });
        }

        const res = await pool.query(query, params);
        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
            ...row,
            matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills,
            missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
        } as Job;

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        if (userId) {
            const { data: userData } = await client
                .from('user_jobs')
                .select('status, match_score, matched_skills, missing_skills, why, archived_at')
                .eq('job_id', id)
                .eq('user_id', userId)
                .single();

            const { data: jobData, error } = await client.from('jobs').select('*').eq('id', id).single();
            if (error || !jobData) return null;

            return {
                ...jobData,
                ...(userData || {}), // Merge user data if exists
                isImported: Boolean(jobData.is_imported),
                date_posted_relative: Boolean(jobData.date_posted_relative),
            } as Job;
        } else {
            const { data, error } = await client.from('jobs').select('*').eq('id', id).single();
            if (error || !data) return null;
            return {
                ...data,
                isImported: Boolean(data.is_imported),
                date_posted_relative: Boolean(data.date_posted_relative),
            } as Job;
        }

    } else {
        const db = getSQLiteDB();
        let row;
        if (userId) {
            row = db.prepare(`
                SELECT j.*, uj.status, uj.match_score, uj.matched_skills, uj.missing_skills, uj.why, uj.archived_at
                FROM jobs j
                LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = ?
                WHERE j.id = ?
            `).get(userId, id);
        } else {
            row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
        }

        if (!row) return null;
        const r = row as any;
        return {
            ...r,
            matched_skills: r.matched_skills ? JSON.parse(r.matched_skills as string) : null,
            missing_skills: r.missing_skills ? JSON.parse(r.missing_skills as string) : null,
            isImported: Boolean(r.is_imported),
            date_posted_relative: Boolean(r.date_posted_relative),
            extraction_confidence: r.extraction_confidence ? JSON.parse(r.extraction_confidence as string) : null,
        } as Job;
    }
}

export async function insertJob(
    userId: string,
    job: Omit<Job, 'id' | 'fetched_at' | 'status' | 'match_score' | 'matched_skills' | 'missing_skills' | 'why' | 'content_hash'>,
    posterDetails?: { firstName: string | null; lastName: string | null; imageUrl: string | null }
): Promise<Job> {
    const { validateJobDescription } = await import('./job-validation');

    const descriptionToValidate = job.normalized_text || job.job_description_plain || '';
    const descValidation = validateJobDescription(descriptionToValidate);

    if (!descValidation.valid) {
        const errorMsg = `Job validation failed: ${descValidation.reason}`;
        console.error('[DB] Insert job validation error:', errorMsg);
        console.error('[DB] Job details:', {
            title: job.title,
            company: job.company,
            descLength: descriptionToValidate.length
        });
        throw new Error(errorMsg);
    }

    const dbType = getDbType();
    const contentHash = generateContentHash(job.title, job.company, job.location, job.normalized_text || '');
    let jobId: string | null = null;

    // Fetch user details for snapshotting
    let posterFirstName: string | null = null;
    let posterLastName: string | null = null;
    let posterImageUrl: string | null = null;

    if (posterDetails) {
        posterFirstName = posterDetails.firstName;
        posterLastName = posterDetails.lastName;
        posterImageUrl = posterDetails.imageUrl;
    }

    if (dbType === 'postgres') {
        const pool = getPostgresPool();

        if (!posterDetails) {
            const userRes = await pool.query('SELECT first_name, last_name, image_url FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length > 0) {
                posterFirstName = userRes.rows[0].first_name;
                posterLastName = userRes.rows[0].last_name;
                posterImageUrl = userRes.rows[0].image_url;
            }
        }

        // 1. Check/Insert Global Job
        const existing = await pool.query('SELECT id FROM jobs WHERE content_hash = $1', [contentHash]);
        if (existing.rows.length > 0) {
            jobId = existing.rows[0].id;
        } else {
            jobId = uuidv4();
            await pool.query(`
                INSERT INTO jobs (
                    id, title, company, location, source_url, posted_at,
                    normalized_text, raw_text_summary, content_hash, is_imported,
                    original_posted_date, original_posted_raw, original_posted_source, location_display, import_tag,
                    raw_description_html, job_description_plain, date_posted_iso,
                    date_posted_display, date_posted_relative, source_host, scraped_at, extraction_confidence,
                    posted_by_user_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            `, [
                jobId, job.title, job.company, job.location, job.source_url, job.posted_at,
                job.normalized_text, job.raw_text_summary, contentHash, job.isImported ? 1 : 0,
                job.original_posted_date || null, job.original_posted_raw || null, job.original_posted_source || null,
                job.location_display || null, job.import_tag || null,
                job.raw_description_html || null, job.job_description_plain || null, job.date_posted_iso || null,
                job.date_posted_display || null, job.date_posted_relative ? 1 : 0,
                job.source_host || null, job.scraped_at || null,
                job.extraction_confidence ? JSON.stringify(job.extraction_confidence) : null,
                userId
            ]);
        }

        // 2. Insert User Job linkage with Snapshot
        await executeWithUser(userId, async (client) => {
            await client.query(`
                INSERT INTO user_jobs (user_id, job_id, status, match_score, poster_first_name, poster_last_name, poster_image_url)
                VALUES ($1, $2, 'fresh', 0, $3, $4, $5)
                ON CONFLICT (user_id, job_id) DO NOTHING
            `, [userId, jobId, posterFirstName, posterLastName, posterImageUrl]);
        });

        // Sync company logo globally if provided
        if ((job as any).company_logo_url && job.company) {
            const { saveCompanyToDb } = await import('./company');
            await saveCompanyToDb(job.company, null, (job as any).company_logo_url);
        }

        return { ...job, id: jobId!, status: 'fresh', match_score: 0, matched_skills: null, missing_skills: null, why: null, content_hash: contentHash, fetched_at: new Date().toISOString() };
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        // Fetch user details for snapshotting
        if (!posterDetails) {
            const { data: user } = await client.from('users').select('first_name, last_name, image_url').eq('id', userId).single();
            if (user) {
                posterFirstName = user.first_name;
                posterLastName = user.last_name;
                posterImageUrl = user.image_url;
            }
        }

        // 1. Check Global Job
        const { data: existing } = await client.from('jobs').select('id').eq('content_hash', contentHash).single();

        if (existing) {
            jobId = existing.id;
        } else {
            jobId = uuidv4();
            const { error: insertError } = await client.from('jobs').insert({
                id: jobId,
                title: job.title,
                company: job.company,
                location: job.location,
                source_url: job.source_url,
                posted_at: job.posted_at,
                normalized_text: job.normalized_text,
                raw_text_summary: job.raw_text_summary,
                content_hash: contentHash,
                is_imported: job.isImported ? 1 : 0,
                original_posted_date: job.original_posted_date || null,
                original_posted_raw: job.original_posted_raw || null,
                original_posted_source: job.original_posted_source || null,
                location_display: job.location_display || null,
                import_tag: job.import_tag || null,
                raw_description_html: job.raw_description_html || null,
                job_description_plain: job.job_description_plain || null,
                date_posted_iso: job.date_posted_iso || null,
                date_posted_display: job.date_posted_display || null,
                date_posted_relative: job.date_posted_relative ? 1 : 0,
                source_host: job.source_host || null,
                scraped_at: job.scraped_at || null,
                extraction_confidence: job.extraction_confidence || null,
                posted_by_user_id: userId
            });
            if (insertError) throw insertError;
        }

        // 2. Link User with Snapshot
        const { error: linkError } = await client.from('user_jobs').upsert({
            user_id: userId,
            job_id: jobId,
            status: 'fresh',
            match_score: 0,
            poster_first_name: posterFirstName,
            poster_last_name: posterLastName,
            poster_image_url: posterImageUrl
        }, { onConflict: 'user_id, job_id' });

        if (linkError) throw linkError;

        return { ...job, id: jobId!, status: 'fresh', match_score: 0, matched_skills: null, missing_skills: null, why: null, content_hash: contentHash, fetched_at: new Date().toISOString() };
    } else {
        const db = getSQLiteDB();
        const existing = db.prepare('SELECT id FROM jobs WHERE content_hash = ?').get(contentHash) as { id: string } | undefined;

        if (existing) {
            jobId = existing.id;
        } else {
            jobId = uuidv4();
            db.prepare(`
            INSERT INTO jobs (
                id, title, company, location, source_url, posted_at,
                normalized_text, raw_text_summary, content_hash, is_imported,
                original_posted_date, original_posted_raw, original_posted_source, location_display, import_tag,
                raw_description_html, job_description_plain, date_posted_iso,
                date_posted_display, date_posted_relative, source_host, scraped_at, extraction_confidence,
                posted_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                jobId, job.title, job.company, job.location, job.source_url, job.posted_at,
                job.normalized_text, job.raw_text_summary, contentHash, job.isImported ? 1 : 0,
                job.original_posted_date || null, job.original_posted_raw || null, job.original_posted_source || null,
                job.location_display || null, job.import_tag || null,
                job.raw_description_html || null, job.job_description_plain || null, job.date_posted_iso || null,
                job.date_posted_display || null, job.date_posted_relative ? 1 : 0,
                job.source_host || null, job.scraped_at || null,
                job.extraction_confidence ? JSON.stringify(job.extraction_confidence) : null,
                userId
            );
        }

        // Link User
        // SQLite doesn't have ON CONFLICT DO NOTHING for simple INSERT easily without constraint triggers, or use INSERT OR IGNORE
        db.prepare('INSERT OR IGNORE INTO user_jobs (user_id, job_id, status, match_score) VALUES (?, ?, ?, ?)').run(userId, jobId, 'fresh', 0);

        return { ...job, id: jobId!, status: 'fresh', match_score: 0, matched_skills: null, missing_skills: null, why: null, content_hash: contentHash, fetched_at: new Date().toISOString() };
    }
}

export async function updateJobScore(
    userId: string,
    jobId: string,
    matchScore: number,
    matchedSkills: string[],
    missingSkills: string[],
    why: string
): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query(`
                UPDATE user_jobs
                SET match_score = $1, matched_skills = $2, missing_skills = $3, why = $4, updated_at = NOW()
                WHERE job_id = $5 AND user_id = $6
            `, [matchScore, JSON.stringify(matchedSkills), JSON.stringify(missingSkills), why, jobId, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('user_jobs')
            .update({
                match_score: matchScore,
                matched_skills: matchedSkills,
                missing_skills: missingSkills,
                why,
            })
            .eq('job_id', jobId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      UPDATE user_jobs 
      SET match_score = ?, matched_skills = ?, missing_skills = ?, why = ?, updated_at = datetime('now')
      WHERE job_id = ? AND user_id = ?
    `).run(matchScore, JSON.stringify(matchedSkills), JSON.stringify(missingSkills), why, jobId, userId);
    }
}

export async function updateJobStatus(userId: string, jobId: string, status: JobStatus): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            if (status === 'archived') {
                await client.query(`
                    INSERT INTO user_jobs (user_id, job_id, status, archived_at, updated_at)
                    VALUES ($3, $2, $1, NOW(), NOW())
                    ON CONFLICT (user_id, job_id) 
                    DO UPDATE SET status = EXCLUDED.status, archived_at = NOW(), updated_at = NOW()
                `, [status, jobId, userId]);
            } else {
                await client.query(`
                    INSERT INTO user_jobs (user_id, job_id, status, archived_at, updated_at)
                    VALUES ($3, $2, $1, NULL, NOW())
                    ON CONFLICT (user_id, job_id) 
                    DO UPDATE SET status = EXCLUDED.status, archived_at = NULL, updated_at = NOW()
                `, [status, jobId, userId]);
            }
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const updateData: { status: JobStatus; archived_at?: string | null } = { status };

        if (status === 'archived') {
            updateData.archived_at = new Date().toISOString();
        } else {
            updateData.archived_at = null;
        }

        const { error } = await client
            .from('user_jobs')
            .update(updateData)
            .eq('job_id', jobId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        if (status === 'archived') {
            db.prepare('UPDATE user_jobs SET status = ?, archived_at = datetime("now"), updated_at = datetime("now") WHERE job_id = ? AND user_id = ?').run(status, jobId, userId);
        } else {
            db.prepare('UPDATE user_jobs SET status = ?, archived_at = NULL, updated_at = datetime("now") WHERE job_id = ? AND user_id = ?').run(status, jobId, userId);
        }
    }
}

export async function deleteJob(userId: string, jobId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        // Only delete the user's reference (un-import/delete from feed)
        // Global job remains
        await executeWithUser(userId, async (client) => {
            await client.query('DELETE FROM user_jobs WHERE job_id = $1 AND user_id = $2', [jobId, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('user_jobs')
            .delete()
            .eq('job_id', jobId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM user_jobs WHERE job_id = ? AND user_id = ?').run(jobId, userId);
    }
}

export interface JobEditFields {
    title: string;
    company: string;
    location: string;
    description: string; // Maps to job_description_plain + normalized_text
    company_logo_url?: string | null;
}

/**
 * Update editable job fields. Only the poster (posted_by_user_id) may edit.
 * Returns the updated job or null if not found / not authorized.
 */
export async function updateJobById(
    userId: string,
    jobId: string,
    fields: JobEditFields
): Promise<Job | null> {
    const dbType = getDbType();

    // Audit log (no PII — just userId hash prefix, jobId, field names)
    console.log('[DB] Job edit audit:', {
        userId: userId.substring(0, 8) + '...',
        jobId,
        changedFields: Object.keys(fields),
        timestamp: new Date().toISOString(),
    });

    if (dbType === 'postgres') {
        const pool = getPostgresPool();

        const res = await pool.query(`
            UPDATE jobs
            SET title = $1, company = $2, location = $3,
                job_description_plain = $4, normalized_text = $4,
                location_display = $3
            WHERE id = $5 AND posted_by_user_id = $6
            RETURNING *
        `, [fields.title, fields.company, fields.location, fields.description, jobId, userId]);

        if (res.rows.length === 0) return null;

        // Sync company logo globally if provided
        if (fields.company_logo_url) {
            const { saveCompanyToDb } = await import('./company');
            await saveCompanyToDb(fields.company, null, fields.company_logo_url);
        }

        const row = res.rows[0];
        return {
            ...row,
            matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills,
            missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
        } as Job;

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        const { data, error } = await client
            .from('jobs')
            .update({
                title: fields.title,
                company: fields.company,
                location: fields.location,
                location_display: fields.location,
                job_description_plain: fields.description,
                normalized_text: fields.description,
            })
            .eq('id', jobId)
            .eq('posted_by_user_id', userId)
            .select()
            .single();

        if (error || !data) return null;

        // Sync company logo globally if provided
        if (fields.company_logo_url) {
            const { saveCompanyToDb } = await import('./company');
            await saveCompanyToDb(fields.company, null, fields.company_logo_url);
        }

        return {
            ...data,
            isImported: Boolean(data.is_imported),
            date_posted_relative: Boolean(data.date_posted_relative),
        } as Job;

    } else {
        const db = getSQLiteDB();

        const result = db.prepare(`
            UPDATE jobs
            SET title = ?, company = ?, location = ?,
                job_description_plain = ?, normalized_text = ?,
                location_display = ?
            WHERE id = ? AND posted_by_user_id = ?
        `).run(
            fields.title, fields.company, fields.location,
            fields.description, fields.description,
            fields.location, jobId, userId
        );

        if ((result as any).changes === 0) return null;

        // Sync company logo globally if provided
        if (fields.company_logo_url) {
            const { saveCompanyToDb } = await import('./company');
            await saveCompanyToDb(fields.company, null, fields.company_logo_url);
        }

        const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
        if (!row) return null;

        return {
            ...row,
            matched_skills: row.matched_skills ? JSON.parse(row.matched_skills as string) : null,
            missing_skills: row.missing_skills ? JSON.parse(row.missing_skills as string) : null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: row.extraction_confidence ? JSON.parse(row.extraction_confidence as string) : null,
        } as Job;
    }
}

export async function archiveOldJobs(): Promise<number> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('archive_old_jobs');
        if (error) throw error;
        return data as number;
    } else {
        return sqliteArchive();
    }
}

export async function purgeOldArchives(): Promise<number> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('purge_old_archives');
        if (error) throw error;
        return data as number;
    } else {
        return sqlitePurge();
    }
}

// ============================================================================
// RESUMES OPERATIONS
// ============================================================================



export async function getResumes(userId: string): Promise<Resume[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT id, filename, upload_at, parsed_json, is_default, s3_key FROM resumes WHERE user_id = $1 AND archived_at IS NULL ORDER BY upload_at DESC', [userId]);
            return res.rows.map(row => ({
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
                is_default: Boolean(row.is_default),
            })) as Resume[];
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('id, filename, upload_at, parsed_json, is_default, s3_key')
            .eq('user_id', userId)
            .order('upload_at', { ascending: false });

        if (error) throw error;
        return data as Resume[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT id, filename, upload_at, parsed_json, is_default, file_data FROM resumes WHERE user_id = ? AND archived_at IS NULL ORDER BY upload_at DESC').all(userId) as Record<string, unknown>[];
        return rows.map((row) => ({
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        })) as Resume[];
    }
}

export async function getDefaultResume(userId: string): Promise<Resume | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM resumes WHERE is_default = TRUE AND user_id = $1', [userId]);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
                is_default: Boolean(row.is_default),
            } as Resume;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('*')
            .eq('is_default', true)
            .eq('user_id', userId)
            .single();

        if (error) return null;
        return data as Resume;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM resumes WHERE is_default = 1 AND user_id = ?').get(userId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        } as Resume;
    }
}

export async function insertResume(userId: string, filename: string, parsedJson: ParsedResume, isDefault: boolean, fileData?: Buffer): Promise<Resume> {
    const dbType = getDbType();
    const id = uuidv4();

    // If setting as default, unset other defaults first
    if (isDefault) {
        await clearDefaultResume(userId);
    }

    if (dbType === 'postgres') {
        let s3Key = null;
        if (fileData) {
            s3Key = generateS3Key('resumes', filename);
            await uploadFileToS3(fileData, s3Key, 'application/pdf');
        }

        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                INSERT INTO resumes (id, user_id, filename, parsed_json, is_default, s3_key)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [id, userId, filename, JSON.stringify(parsedJson), isDefault ? true : false, s3Key]);

            const row = res.rows[0];
            return {
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
                is_default: Boolean(row.is_default),
            } as Resume;
        });
    } else if (dbType === 'supabase') {
        let s3Key = null;
        if (fileData) {
            s3Key = generateS3Key('resumes', filename);
            await uploadFileToS3(fileData, s3Key, 'application/pdf');
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .insert({
                id,
                user_id: userId,
                filename,
                parsed_json: parsedJson as unknown as Record<string, unknown>,
                is_default: isDefault,
                s3_key: s3Key,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Resume;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      INSERT INTO resumes (id, user_id, filename, parsed_json, is_default, file_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, filename, JSON.stringify(parsedJson), isDefault ? 1 : 0, fileData || null);

        const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as Record<string, unknown>;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        } as Resume;
    }
}

export async function updateResume(userId: string, id: string, updates: Partial<Resume>): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            const sets: string[] = [];
            const values: any[] = [];
            let idx = 1;

            if (updates.parsed_json !== undefined) {
                sets.push(`parsed_json = $${idx++}`);
                values.push(JSON.stringify(updates.parsed_json));
            }
            if (updates.filename !== undefined) {
                sets.push(`filename = $${idx++}`);
                values.push(updates.filename);
            }
            if (updates.is_default !== undefined) {
                sets.push(`is_default = $${idx++}`);
                values.push(updates.is_default);
            }

            if (sets.length > 0) {
                values.push(id);
                values.push(userId);
                await client.query(`UPDATE resumes SET ${sets.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1}`, values);
            }
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const dbUpdates: any = {};
        if (updates.parsed_json !== undefined) dbUpdates.parsed_json = updates.parsed_json;
        if (updates.filename !== undefined) dbUpdates.filename = updates.filename;
        if (updates.is_default !== undefined) dbUpdates.is_default = updates.is_default;

        const { error } = await client
            .from('resumes')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        const sets: string[] = [];
        const values: any[] = [];

        if (updates.parsed_json !== undefined) {
            sets.push('parsed_json = ?');
            values.push(JSON.stringify(updates.parsed_json));
        }
        if (updates.filename !== undefined) {
            sets.push('filename = ?');
            values.push(updates.filename);
        }
        if (updates.is_default !== undefined) {
            sets.push('is_default = ?');
            values.push(updates.is_default ? 1 : 0);
        }

        if (sets.length > 0) {
            values.push(id);
            values.push(userId);
            db.prepare(`UPDATE resumes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
        }
    }
}

export async function getResumeById(userId: string, id: string): Promise<{ resume: Resume; file_data: Buffer | null; file_url?: string } | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
            if (res.rows.length === 0) return null;

            const data = res.rows[0];
            let fileUrl = undefined;
            let fileBuffer = null;

            if (data.s3_key) {
                fileUrl = await getSignedDownloadUrl(data.s3_key);
                const s3Client = getS3Client();
                if (s3Client && data.s3_key) {
                    try {
                        const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: data.s3_key }));
                        if (Body) {
                            const byteArray = await Body.transformToByteArray();
                            fileBuffer = Buffer.from(byteArray);
                        }
                    } catch (e) {
                        console.error("Failed to fetch S3 object", e);
                    }
                }
            }

            return {
                resume: {
                    id: data.id,
                    filename: data.filename,
                    upload_at: data.upload_at,
                    parsed_json: typeof data.parsed_json === 'string' ? JSON.parse(data.parsed_json) : data.parsed_json,
                    is_default: Boolean(data.is_default),
                    s3_key: data.s3_key
                } as Resume,
                file_data: fileBuffer,
                file_url: fileUrl
            };
        });

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        let fileUrl = undefined;
        let fileBuffer = null;

        if (data.s3_key) {
            // For getResumeById, we usually need the buffer for parsing.
            // But if we just need a URL for download, we have getSignedDownloadUrl
            // Let's support both. Ideally we stop passing Buffers around, but for now we might need to fetch it from S3 if the caller needs 'file_data'.

            // Wait, the caller often needs file_data for parsing. 
            // We should fetch it if requested or return the URL.
            // For now, let's provide the URL primarily. If the app relies on file_data, we might need to fetch it.
            // Let's modify the return signature to include file_url.
            fileUrl = await getSignedDownloadUrl(data.s3_key);

            // TODO: Check if we absolutely need to return file_data Buffer here. 
            // Most AI parsing logic can take text or we can fetch the S3 object stream.
            // For now, to keep compatible signatures, we will fetch the object if file_data is expected and missing, 
            // BUT getting buffer from S3 every time is slow. 
            // Let's see where getResumeById is used. It is used in enhanced-tailored-resume-service.ts to parse PDF.
            // So we DO need the buffer there unless we change how parsing works.
            // I'll fetch it from S3 if s3_key exists.

            const s3Client = getS3Client();
            if (s3Client && data.s3_key) {
                try {
                    const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: data.s3_key }));
                    if (Body) {
                        const byteArray = await Body.transformToByteArray();
                        fileBuffer = Buffer.from(byteArray);
                    }
                } catch (e) {
                    console.error("Failed to fetch S3 object", e);
                }
            }
        }

        return {
            resume: {
                id: data.id,
                filename: data.filename,
                upload_at: data.upload_at,
                parsed_json: data.parsed_json,
                is_default: data.is_default,
                s3_key: data.s3_key
            } as Resume,
            file_data: fileBuffer, // Will be null if s3 fetch failed or not stored
            file_url: fileUrl
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            resume: {
                id: row.id as string,
                filename: row.filename as string,
                upload_at: row.upload_at as string,
                parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
                is_default: Boolean(row.is_default),
            } as Resume,
            file_data: row.file_data as Buffer | null,
        };
    }
}

// Helper to get resume metadata (no file content)
export async function getResumeMetadata(userId: string, id: string): Promise<Resume | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2 AND archived_at IS NULL', [id, userId]);
            if (res.rows.length === 0) return null;
            return {
                ...res.rows[0],
                parsed_json: typeof res.rows[0].parsed_json === 'string' ? JSON.parse(res.rows[0].parsed_json) : res.rows[0].parsed_json,
                is_default: Boolean(res.rows[0].is_default),
            } as Resume;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .is('archived_at', null)
            .single();

        if (error || !data) return null;
        return data as Resume;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ? AND archived_at IS NULL').get(id, userId) as Record<string, unknown>;
        if (!row) return null;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        } as Resume;
    }
}

export async function deleteResume(userId: string, id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            // Soft delete: Update archived_at
            await client.query('UPDATE resumes SET archived_at = NOW() WHERE id = $1 AND user_id = $2', [id, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resumes')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE resumes SET archived_at = datetime(\'now\') WHERE id = ? AND user_id = ?').run(id, userId);
    }
}

export async function setDefaultResume(userId: string, resumeId: string): Promise<void> {
    await clearDefaultResume(userId);

    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query('UPDATE resumes SET is_default = TRUE WHERE id = $1 AND user_id = $2', [resumeId, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resumes')
            .update({ is_default: true })
            .eq('id', resumeId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE resumes SET is_default = 1 WHERE id = ? AND user_id = ?').run(resumeId, userId);
    }
}

async function clearDefaultResume(userId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query('UPDATE resumes SET is_default = FALSE WHERE is_default = TRUE AND user_id = $1', [userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        await client.from('resumes').update({ is_default: false }).eq('is_default', true).eq('user_id', userId);
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE resumes SET is_default = 0 WHERE is_default = 1 AND user_id = ?').run(userId);
    }
}

// ============================================================================
// LINKEDIN PROFILES OPERATIONS
// ============================================================================

export async function getLinkedInProfile(userId: string): Promise<LinkedInProfile | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM linkedin_profiles WHERE user_id = $1 ORDER BY upload_at DESC LIMIT 1', [userId]);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
            } as LinkedInProfile;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('upload_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;
        return data as LinkedInProfile;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM linkedin_profiles WHERE user_id = ? ORDER BY upload_at DESC LIMIT 1').get(userId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
        } as LinkedInProfile;
    }
}

export async function insertLinkedInProfile(userId: string, filename: string, parsedJson: ParsedResume, fileData?: Buffer): Promise<LinkedInProfile> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'postgres') {
        let s3Key = null;
        if (fileData) {
            s3Key = generateS3Key('linkedin', filename);
            await uploadFileToS3(fileData, s3Key, 'application/pdf');
        }

        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                INSERT INTO linkedin_profiles (id, user_id, filename, parsed_json, s3_key)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [id, userId, filename, JSON.stringify(parsedJson), s3Key]);
            const row = res.rows[0];
            return {
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
            } as LinkedInProfile;
        });
    } else if (dbType === 'supabase') {
        let s3Key = null;
        if (fileData) {
            s3Key = generateS3Key('linkedin', filename);
            await uploadFileToS3(fileData, s3Key, 'application/pdf');
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .insert({
                id,
                user_id: userId,
                filename,
                parsed_json: parsedJson as unknown as Record<string, unknown>,
                s3_key: s3Key,
            })
            .select()
            .single();

        if (error) throw error;
        return data as LinkedInProfile;
    } else {
        const db = getSQLiteDB();
        const stmt = db.prepare('INSERT INTO linkedin_profiles (id, user_id, filename, parsed_json, file_data) VALUES (?, ?, ?, ?, ?) RETURNING *');
        const row = stmt.get(id, userId, filename, JSON.stringify(parsedJson), fileData) as Record<string, unknown>;
        return {
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
        } as LinkedInProfile;
    }
}

export async function getAllLinkedInProfiles(userId: string): Promise<LinkedInProfile[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM linkedin_profiles WHERE user_id = $1 ORDER BY upload_at DESC', [userId]);
            return res.rows.map(row => ({
                ...row,
                parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
            })) as LinkedInProfile[];
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('upload_at', { ascending: false });

        if (error) {
            console.error('Error fetching linkedin profiles:', error);
            return [];
        }
        return data as LinkedInProfile[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT * FROM linkedin_profiles WHERE user_id = ? ORDER BY upload_at DESC').all(userId) as Record<string, unknown>[];

        return rows.map(row => ({
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
        })) as LinkedInProfile[];
    }
}

export async function deleteLinkedInProfile(userId: string, id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            // Remove from S3 first
            const res = await client.query('SELECT s3_key FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
            if (res.rows.length > 0 && res.rows[0].s3_key) {
                await deleteFileFromS3(res.rows[0].s3_key);
            }
            await client.query('DELETE FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        // Remove from S3 first
        const { data } = await client.from('linkedin_profiles').select('s3_key').eq('id', id).eq('user_id', userId).single();
        if (data?.s3_key) {
            await deleteFileFromS3(data.s3_key);
        }

        const { error } = await client.from('linkedin_profiles').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM linkedin_profiles WHERE id = ? AND user_id = ?').run(id, userId);
    }
}

export async function getLinkedInProfileById(userId: string, id: string): Promise<{ profile: LinkedInProfile; file_data: Buffer | null } | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
            if (res.rows.length === 0) return null;

            const data = res.rows[0];
            let fileBuffer = null;
            if (data.s3_key) {
                const s3Client = getS3Client();
                if (s3Client) {
                    try {
                        const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: data.s3_key }));
                        if (Body) {
                            const byteArray = await Body.transformToByteArray();
                            fileBuffer = Buffer.from(byteArray);
                        }
                    } catch (e) {
                        console.error("Failed to fetch S3 object", e);
                    }
                }
            }
            return {
                profile: {
                    id: data.id,
                    filename: data.filename,
                    upload_at: data.upload_at,
                    parsed_json: typeof data.parsed_json === 'string' ? JSON.parse(data.parsed_json) : data.parsed_json,
                    s3_key: data.s3_key
                } as LinkedInProfile,
                file_data: fileBuffer,
            };
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        let fileBuffer = null;
        if (data.s3_key) {
            const s3Client = getS3Client();
            if (s3Client) {
                try {
                    const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: data.s3_key }));
                    if (Body) {
                        const byteArray = await Body.transformToByteArray();
                        fileBuffer = Buffer.from(byteArray);
                    }
                } catch (e) {
                    console.error("Failed to fetch S3 object", e);
                }
            }
        }

        return {
            profile: {
                id: data.id,
                filename: data.filename,
                upload_at: data.upload_at,
                parsed_json: data.parsed_json,
                s3_key: data.s3_key
            } as LinkedInProfile,
            file_data: fileBuffer,
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM linkedin_profiles WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            profile: {
                ...row,
                parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            } as LinkedInProfile,
            file_data: row.file_data as Buffer | null,
        };
    }
}

// ============================================================================
// APPLICATIONS OPERATIONS
// ============================================================================

export async function getApplications(userId: string): Promise<Application[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM applications WHERE user_id = $1 AND deleted = FALSE ORDER BY applied_at DESC', [userId]);
            return res.rows.map(row => ({
                ...row,
                deleted: Boolean(row.deleted),
            })) as Application[];
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .select('*')
            .eq('user_id', userId)
            .eq('deleted', false)
            .order('applied_at', { ascending: false });

        if (error) throw error;
        return data as Application[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT * FROM applications WHERE user_id = ? AND deleted = 0 ORDER BY applied_at DESC').all(userId) as Record<string, unknown>[];
        return rows.map((row) => ({
            ...row,
            deleted: Boolean(row.deleted),
        })) as Application[];
    }
}

export async function getApplicationByJobId(userId: string, jobId: string): Promise<Application | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM applications WHERE job_id = $1 AND user_id = $2 AND deleted = FALSE', [jobId, userId]);
            if (res.rows.length === 0) return null;
            return {
                ...res.rows[0],
                deleted: Boolean(res.rows[0].deleted),
            } as Application;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .select('*')
            .eq('job_id', jobId)
            .eq('user_id', userId)
            .eq('deleted', false)
            .single();

        if (error) return null;
        return data as Application;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM applications WHERE job_id = ? AND user_id = ? AND deleted = 0').get(jobId, userId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            deleted: Boolean(row.deleted),
        } as Application;
    }
}

export async function createApplication(userId: string, jobId: string, externalLink: string): Promise<Application> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                INSERT INTO applications (id, user_id, job_id, column_name, external_link)
                VALUES ($1, $2, $3, 'Applied', $4)
                RETURNING *
            `, [id, userId, jobId, externalLink]);
            return res.rows[0] as Application;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .insert({
                id,
                user_id: userId,
                job_id: jobId,
                column_name: 'Applied',
                external_link: externalLink,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Application;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      INSERT INTO applications (id, user_id, job_id, column_name, external_link)
      VALUES (?, ?, ?, 'Applied', ?)
    `).run(id, userId, jobId, externalLink);

        const row = db.prepare('SELECT * FROM application WHERE id = ?').get(id) as Record<string, unknown>;
        return {
            ...row,
            deleted: Boolean(row.deleted),
        } as Application;
    }
}

export async function updateApplicationColumn(userId: string, applicationId: string, column: ApplicationColumn): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query('UPDATE applications SET column_name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [column, applicationId, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('applications')
            .update({ column_name: column })
            .eq('id', applicationId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`UPDATE applications SET column_name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(column, applicationId, userId);
    }
}

export async function deleteApplication(userId: string, applicationId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query('UPDATE applications SET deleted = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2', [applicationId, userId]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('applications')
            .update({ deleted: true })
            .eq('id', applicationId)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`UPDATE applications SET deleted = 1, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(applicationId, userId);
    }
}

// ============================================================================
// COVER LETTERS OPERATIONS
// ============================================================================

export async function insertCoverLetter(
    userId: string,
    jobId: string,
    resumeId: string | null,
    contentHtml: string | null,
    contentText: string | null,
    status: 'pending' | 'generated' | 'failed' = 'generated'
): Promise<CoverLetter> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                INSERT INTO cover_letters (id, user_id, job_id, resume_id, content_html, content_text, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [id, userId, jobId, resumeId, contentHtml, contentText, status]);
            return res.rows[0] as unknown as CoverLetter;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .insert({
                id,
                user_id: userId,
                job_id: jobId,
                resume_id: resumeId,
                content_html: contentHtml,
                content_text: contentText,
                status,
            })
            .select()
            .single();

        if (error) throw error;
        return data as CoverLetter;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      INSERT INTO cover_letters (id, user_id, job_id, resume_id, content_html, content_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, jobId, resumeId, contentHtml, contentText, status);

        const row = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(id) as Record<string, unknown>;
        return row as unknown as CoverLetter;
    }
}

export async function updateCoverLetter(userId: string, id: string, updates: Partial<CoverLetter>): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            const sets: string[] = [];
            const values: any[] = [];
            let idx = 1;

            if (updates.content_html !== undefined) {
                sets.push(`content_html = $${idx++}`);
                values.push(updates.content_html);
            }
            if (updates.content_text !== undefined) {
                sets.push(`content_text = $${idx++}`);
                values.push(updates.content_text);
            }
            if (updates.pdf_blob_url !== undefined) {
                sets.push(`pdf_blob_url = $${idx++}`);
                values.push(updates.pdf_blob_url);
            }
            if (updates.status !== undefined) {
                sets.push(`status = $${idx++}`);
                values.push(updates.status);
            }
            if (updates.s3_key !== undefined) {
                sets.push(`s3_key = $${idx++}`);
                values.push(updates.s3_key);
            }

            if (sets.length > 0) {
                values.push(id);
                values.push(userId);
                await client.query(`UPDATE cover_letters SET ${sets.join(', ')}, generated_at = NOW() WHERE id = $${idx} AND user_id = $${idx + 1}`, values);
            }
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('cover_letters')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        const sets: string[] = [];
        const values: any[] = [];

        if (updates.content_html !== undefined) {
            sets.push('content_html = ?');
            values.push(updates.content_html);
        }
        if (updates.content_text !== undefined) {
            sets.push('content_text = ?');
            values.push(updates.content_text);
        }
        if (updates.pdf_blob_url !== undefined) {
            sets.push('pdf_blob_url = ?');
            values.push(updates.pdf_blob_url);
        }
        if (updates.status !== undefined) {
            sets.push('status = ?');
            values.push(updates.status);
        }
        // Add s3_key support for SQLite (though strictly not needed for Prod, good for compatibility)
        // Note: SQLite schema might not have s3_key column. We might need to migrate it if we want full compat.
        // For now, we skip s3_key in SQLite unless we add the column. 
        // Given instructions are "SQLite may remain ONLY for local development", 
        // we can assume local dev doesn't strictly need S3 unless "gated".
        // But let's add it if defined, it will throw if column missing, which is fine (we catch errors).
        // Actually, better to ignore s3_key for SQLite if column doesn't exist?
        // Let's assume we might add it later.

        if (sets.length > 0) {
            values.push(id);
            values.push(userId);
            db.prepare(`UPDATE cover_letters SET ${sets.join(', ')}, generated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(...values);
        }
    }
}

// Helper to get pending cover letters
export async function getPendingCoverLetters(userId: string, limit: number = 5): Promise<Array<{ id: string, job_id: string, resume_id: string | null }>> {
    const dbType = getDbType();
    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT id, job_id, resume_id FROM cover_letters WHERE user_id = $1 AND status = \'pending\' ORDER BY created_at ASC LIMIT $2', [userId, limit]);
            return res.rows;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .select('id, job_id, resume_id')
            .eq('status', 'pending')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('Error fetching pending cover letters:', error);
            return [];
        }
        return data as Array<{ id: string, job_id: string, resume_id: string | null }>;
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare(`
        SELECT id, job_id, resume_id 
        FROM cover_letters 
        WHERE status = 'pending' AND user_id = ?
        ORDER BY created_at ASC 
        LIMIT ?
    `).all(userId, limit) as Array<{ id: string, job_id: string, resume_id: string | null }>;
        return rows;
    }
}

export async function getCoverLetterById(userId: string, id: string): Promise<CoverLetter | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM cover_letters WHERE id = $1 AND user_id = $2', [id, userId]);
            if (res.rows.length === 0) return null;

            const data = res.rows[0];
            if (data.s3_key) {
                const signedUrl = await getSignedDownloadUrl(data.s3_key);
                data.pdf_blob_url = signedUrl;
            }
            return data as CoverLetter;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) return null;

        // If s3_key exists, sign the URL and update pdf_blob_url (ephemeral)
        if (data.s3_key) {
            const signedUrl = await getSignedDownloadUrl(data.s3_key);
            data.pdf_blob_url = signedUrl;
        }

        return data as CoverLetter;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM cover_letters WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
        if (!row) return null;
        return row as unknown as CoverLetter;
    }
}

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================

export async function getSettings(userId: string): Promise<{
    freshLimit: number;
    lastUpdated: string | null;
    excludedKeywords: string[];
    themePreferences: { mode: string; themeId: string } | null;
}> {
    const dbType = getDbType();
    const defaults = { freshLimit: 300, lastUpdated: null, excludedKeywords: [], themePreferences: { mode: 'light', themeId: 'aladdin' } };

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query(`
                SELECT 
                    a.fresh_limit, 
                    a.last_updated, 
                    a.excluded_keywords
                FROM app_settings a
                WHERE a.user_id = $1
            `, [userId]);

            if (res.rows.length === 0) return defaults;
            const row = res.rows[0];

            return {
                freshLimit: row.fresh_limit || 300,
                lastUpdated: row.last_updated || null,
                excludedKeywords: typeof row.excluded_keywords === 'string' ? JSON.parse(row.excluded_keywords) : row.excluded_keywords || [],
                themePreferences: { mode: 'light', themeId: 'aladdin' }
            };
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        // Parallel fetch for now as Supabase join syntax via JS client can be verbose
        // Assuming app_settings exists for user, if not we handle nulls
        // Parallel fetch for now as Supabase join syntax via JS client can be verbose
        // Assuming app_settings exists for user, if not we handle nulls
        const [settingsRes] = await Promise.all([
            client.from('app_settings').select('fresh_limit, last_updated, excluded_keywords').eq('user_id', userId).single()
        ]);

        const settingsData = (settingsRes.data || {}) as { fresh_limit?: number; last_updated?: string; excluded_keywords?: string[] };

        return {
            freshLimit: settingsData.fresh_limit || 300,
            lastUpdated: settingsData.last_updated || null,
            excludedKeywords: settingsData.excluded_keywords || [],
            themePreferences: { mode: 'light', themeId: 'aladdin' },
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare(`
            SELECT 
                a.fresh_limit, 
                a.last_updated, 
                a.excluded_keywords
            FROM app_settings a
            WHERE a.user_id = ?
        `).get(userId) as Record<string, unknown> | undefined;

        if (!row) {
            // Backup check if user exists in app_settings but not users (shouldn't happen)
            const appSet = db.prepare('SELECT fresh_limit, last_updated, excluded_keywords FROM app_settings WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
            if (appSet) {
                return {
                    freshLimit: appSet.fresh_limit as number,
                    lastUpdated: appSet.last_updated as string | null,
                    excludedKeywords: appSet.excluded_keywords ? JSON.parse(appSet.excluded_keywords as string) : [],
                    themePreferences: { mode: 'light', themeId: 'aladdin' }
                };
            }
            return defaults;
        }

        return {
            freshLimit: (row.fresh_limit as number) || 300,
            lastUpdated: row.last_updated as string | null,
            excludedKeywords: row.excluded_keywords ? JSON.parse(row.excluded_keywords as string) : [],
            themePreferences: { mode: 'light', themeId: 'aladdin' },
        };
    }
}

export async function updateSettings(userId: string, settings: {
    freshLimit?: number;
    excludedKeywords?: string[];
    themePreferences?: any;
}): Promise<void> {
    const dbType = getDbType();

    // Split updates into two parts: User Profile (Theme) and App Settings
    // ... inside updateSettings
    const hasThemeUpdates = !!settings.themePreferences;
    const hasAppUpdates = settings.freshLimit !== undefined || settings.excludedKeywords !== undefined;

    if (hasThemeUpdates) {
        console.log('[DEBUG-DB] Theme updates received but DB storage is disabled (schema change)');
    }

    if (hasAppUpdates) {
        // Fetch current for merge or upsert
        // We can just UPSERT with provided values, relying on previous logic or simplifying
        // Since excludedKeywords is array, we need to handle it carefully.

        // Simplified Upsert Logic for App Settings

        if (dbType === 'postgres') {
            await executeWithUser(userId, async (client) => {
                // If simple upsert doesn't work for partials without fetching, we might need dynamic query
                // But typically for settings, we want to set what we have.
                // If undefined, we shouldn't overwrite with null.

                // Construct dynamic set clause
                const updates: string[] = [];
                const values: any[] = [userId];
                let idx = 2; // $1 is userId

                if (settings.freshLimit !== undefined) {
                    updates.push(`fresh_limit = $${idx++}`);
                    values.push(settings.freshLimit);
                }
                if (settings.excludedKeywords !== undefined) {
                    updates.push(`excluded_keywords = $${idx++} `);
                    values.push(JSON.stringify(settings.excludedKeywords));
                }

                if (updates.length > 0) {
                    await client.query(`
                        INSERT INTO app_settings(user_id, fresh_limit, excluded_keywords)
        VALUES($1, ${settings.freshLimit !== undefined ? '$2' : 'DEFAULT'}, ${settings.excludedKeywords !== undefined ? (settings.freshLimit !== undefined ? '$3' : '$2') : 'DEFAULT'})
                        ON CONFLICT(user_id) DO UPDATE SET ${updates.join(', ')}
        `, values); // Note: The INSERT VALUES part is tricky for dynamic.

                    // Safer Fallback: Just UPDATE if exists, INSERT if not?
                    // Or just standard UPSERT with COALESCE on input?

                    // Let's use the explicit UPSERT query that handles nulls by using COALESCE with EXCLUDED? No, input is what matters.

                    // Simply run the upsert for each field if present? No inefficient.

                    // Let's stick to the previous implementation style but remove theme_preferences

                    const current = await getSettings(userId);
                    const freshLimit = settings.freshLimit ?? current.freshLimit;
                    const excludedKeywords = settings.excludedKeywords ?? current.excludedKeywords;

                    await client.query(`
                        INSERT INTO app_settings(user_id, fresh_limit, excluded_keywords)
        VALUES($1, $2, $3)
                        ON CONFLICT(user_id) DO UPDATE SET
        fresh_limit = $2,
            excluded_keywords = $3
                `, [userId, freshLimit, JSON.stringify(excludedKeywords)]);
                }
            });
        } else if (dbType === 'supabase') {
            const client = getSupabaseClient();
            const updates: any = { user_id: userId };
            if (settings.freshLimit !== undefined) updates.fresh_limit = settings.freshLimit;
            if (settings.excludedKeywords !== undefined) updates.excluded_keywords = settings.excludedKeywords;

            await client.from('app_settings').upsert(updates, { onConflict: 'user_id' });
        } else {
            const db = getSQLiteDB();
            const current = await getSettings(userId); // Re-use getSettings to merge
            const freshLimit = settings.freshLimit ?? current.freshLimit;
            const excludedKeywords = settings.excludedKeywords ?? current.excludedKeywords;

            db.prepare(`
                INSERT INTO app_settings(user_id, fresh_limit, excluded_keywords)
        VALUES(?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
        fresh_limit = ?,
            excluded_keywords = ?
                `).run(
                userId,
                freshLimit,
                JSON.stringify(excludedKeywords),
                freshLimit,
                JSON.stringify(excludedKeywords)
            );
        }
    }
}

export async function updateLastUpdated(userId: string): Promise<void> {
    const dbType = getDbType();
    const now = new Date().toISOString();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query(`
                INSERT INTO app_settings(user_id, last_updated) VALUES($1, $2)
                ON CONFLICT(user_id) DO UPDATE SET last_updated = $2
            `, [userId, now]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('app_settings')
            .upsert({ user_id: userId, last_updated: now }, { onConflict: 'user_id' });

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
            INSERT INTO app_settings(user_id, last_updated) VALUES(?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_updated = ?
            `).run(userId, now, now);
    }
}

// ==========================================
// AI Provider Stats (Safety & Limits)
// ==========================================

export interface AIProviderStats {
    provider_name: string;
    status: string;
    calls_today: number;
    last_reset: string | null;
}


export async function getProviderStats(providerName: string): Promise<AIProviderStats | null> {
    const dbType = getDbType();

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            try {
                const res = await pool.query('SELECT * FROM ai_provider_stats WHERE provider_name = $1', [providerName]);
                if (res.rows.length === 0) {
                    // Try to initialize, but don't fail if table missing or permissions denied
                    try {
                        await pool.query('INSERT INTO ai_provider_stats (provider_name) VALUES ($1) ON CONFLICT DO NOTHING', [providerName]);
                        const res2 = await pool.query('SELECT * FROM ai_provider_stats WHERE provider_name = $1', [providerName]);
                        return res2.rows[0] as AIProviderStats;
                    } catch (e) {
                        // Failed to insert/fetch after insert - return null but don't crash
                        return null;
                    }
                }
                return res.rows[0] as AIProviderStats;
            } catch (error: any) {
                // Silently return null if table missing — this is expected
                // when the migration hasn't been run yet
                return null;
            }
        } else if (dbType === 'supabase') {
            // Supabase migration not applied yet, assume in-memory fallback in router
            return null;
        } else {
            const db = getSQLiteDB();
            try {
                let row = db.prepare('SELECT * FROM ai_provider_stats WHERE provider_name = ?').get(providerName) as AIProviderStats | undefined;

                if (!row) {
                    // Initialize if missing
                    db.prepare('INSERT OR IGNORE INTO ai_provider_stats (provider_name) VALUES (?)').run(providerName);
                    row = db.prepare('SELECT * FROM ai_provider_stats WHERE provider_name = ?').get(providerName) as AIProviderStats;
                }
                return row || null;
            } catch (error) {
                console.warn(`[DB] SQLite stats error(non - fatal): `, error);
                return null;
            }
        }
    } catch (error) {
        // Ultimate safety net
        return null;
    }
}

export async function updateProviderStats(providerName: string, updates: Partial<AIProviderStats>): Promise<void> {
    const dbType = getDbType();

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            const fields = Object.keys(updates).filter(k => k !== 'provider_name');
            if (fields.length === 0) return;

            const setClause = fields.map((k, i) => `${k} = $${i + 2} `).join(', ');
            const values = [providerName, ...fields.map(k => (updates as any)[k])];

            try {
                await pool.query(`UPDATE ai_provider_stats SET ${setClause}, updated_at = NOW() WHERE provider_name = $1`, values);
            } catch (e: any) {
                // Start silently if table missing, otherwise warn
                if (!e.message?.includes('does not exist')) {
                    console.warn(`[DB] Failed to update stats for ${providerName}: `, e.message);
                }
            }
        } else if (dbType === 'supabase') {
            // No-op for now
            return;
        } else {
            const db = getSQLiteDB();
            const fields = Object.keys(updates).filter(k => k !== 'provider_name');
            if (fields.length === 0) return;

            const setClause = fields.map(k => `${k} = @${k} `).join(', ');

            try {
                db.prepare(`
                    UPDATE ai_provider_stats 
                    SET ${setClause}, updated_at = datetime('now') 
                    WHERE provider_name = @provider_name
            `).run({ ...updates, provider_name: providerName });
            } catch (error) {
                // Ignore errors
            }
        }
    } catch (error) {
        // Ignore top-level errors for stats updates
    }
}



// ============================================================================
// RESUME DRAFTS OPERATIONS
// ============================================================================

export async function createDraft(
    id: string,
    userId: string,
    resumeData: any, // JSON
    jobId?: string
): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        await executeWithUser(userId, async (client) => {
            await client.query(`
                INSERT INTO resume_drafts(id, user_id, resume_data, job_id, updated_at)
        VALUES($1, $2, $3, $4, NOW())
                ON CONFLICT(id) DO UPDATE SET
        resume_data = EXCLUDED.resume_data,
            job_id = EXCLUDED.job_id,
            updated_at = EXCLUDED.updated_at
                `, [id, userId, JSON.stringify(resumeData), jobId || null]);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resume_drafts')
            .upsert({
                id,
                user_id: userId,
                resume_data: resumeData,
                job_id: jobId,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
            INSERT INTO resume_drafts(id, user_id, resume_data, job_id, updated_at)
        VALUES(?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
        resume_data = excluded.resume_data,
            job_id = excluded.job_id,
            updated_at = excluded.updated_at
                `).run(id, userId, JSON.stringify(resumeData), jobId || null);
    }
}

export async function getDraft(id: string): Promise<any | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query('SELECT resume_data FROM resume_drafts WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        // Postgres jsonb might already be an object
        const row = res.rows[0];
        return typeof row.resume_data === 'string' ? JSON.parse(row.resume_data) : row.resume_data;
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resume_drafts')
            .select('resume_data')
            .eq('id', id)
            .single();

        if (error || !data) return null;
        return data.resume_data;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT resume_data FROM resume_drafts WHERE id = ?').get(id) as { resume_data: string } | undefined;
        if (!row) return null;
        return JSON.parse(row.resume_data);
    }
}

export async function listDrafts(userId: string): Promise<any[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT resume_data FROM resume_drafts WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
            return res.rows.map(row => typeof row.resume_data === 'string' ? JSON.parse(row.resume_data) : row.resume_data);
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resume_drafts')
            .select('resume_data, updated_at') // We just need data, sort by updated_at
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) return [];
        return data.map((d: any) => d.resume_data);
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT resume_data FROM resume_drafts WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as { resume_data: string }[];
        return rows.map(r => JSON.parse(r.resume_data));
    }
}

export async function deleteDraft(id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        await pool.query('DELETE FROM resume_drafts WHERE id = $1', [id]);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resume_drafts')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM resume_drafts WHERE id = ?').run(id);
    }
}
export async function getAllFreshJobsSystem(limit: number = 100): Promise<Job[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query(
            `SELECT * FROM jobs ORDER BY posted_at DESC NULLS LAST LIMIT $1`,
            [limit]
        );
        return res.rows.map(row => ({
            ...row,
            matched_skills: null,
            missing_skills: null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
        })) as Job[];
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .order('posted_at', { ascending: false, nullsFirst: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
        })) as Job[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare(`
        SELECT * FROM jobs 
        ORDER BY CASE WHEN posted_at IS NULL THEN 1 ELSE 0 END, posted_at DESC
        LIMIT ?
            `).all(limit) as Record<string, unknown>[];

        return rows.map((row) => ({
            ...row,
            matched_skills: null,
            missing_skills: null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: row.extraction_confidence ? JSON.parse(row.extraction_confidence as string) : null,
        })) as Job[];
    }
}

export async function deleteJobSystem(jobId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('jobs')
            .delete()
            .eq('id', jobId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
    }
}

export async function getPendingCoverLettersSystem(limit: number = 5): Promise<Array<{ id: string, job_id: string, resume_id: string | null, user_id: string }>> {
    const dbType = getDbType();
    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query(`
            SELECT id, job_id, resume_id, user_id 
            FROM cover_letters 
            WHERE status = 'pending'
            ORDER BY created_at ASC 
            LIMIT $1
            `, [limit]);
        return res.rows as Array<{ id: string, job_id: string, resume_id: string | null, user_id: string }>;

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .select('id, job_id, resume_id, user_id')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('Error fetching pending cover letters:', error);
            return [];
        }
        return data as Array<{ id: string, job_id: string, resume_id: string | null, user_id: string }>;
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare(`
        SELECT id, job_id, resume_id, user_id
        FROM cover_letters 
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
            `).all(limit) as Array<{ id: string, job_id: string, resume_id: string | null, user_id: string }>;
        return rows;
    }
}

// ============================================================================
// USER PROFILE OPERATIONS (Custom Usernames)
// ============================================================================

export interface UserProfile {
    id: string;
    name: string | null;
    username?: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get user profile by user ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        return executeWithUser(userId, async (client) => {
            const res = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (res.rows.length === 0) return null;
            return res.rows[0] as UserProfile;
        });
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) return null;
        return data as UserProfile;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserProfile | undefined;
        return row || null;
    }
}

/**
 * Check if a username already exists (for another user)
 */
export async function checkUsernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        // Since we unified to 'name' which isn't necessarily unique, this check might be irrelevant 
        // OR we should assume 'name' is the username. Let's assume name for now.
        let query = 'SELECT 1 FROM users WHERE LOWER(name) = LOWER($1)';
        const params: string[] = [username];

        if (excludeUserId) {
            query += ' AND id != $2';
            params.push(excludeUserId);
        }

        const res = await pool.query(query, params);
        return res.rows.length > 0;
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        let query = client
            .from('users')
            .select('id')
            .ilike('name', username);

        if (excludeUserId) {
            query = query.neq('id', excludeUserId);
        }

        const { data } = await query;
        return (data?.length || 0) > 0;
    } else {
        const db = getSQLiteDB();
        let query = 'SELECT 1 FROM users WHERE LOWER(name) = LOWER(?)';
        const params: string[] = [username];

        if (excludeUserId) {
            query += ' AND id != ?';
            params.push(excludeUserId);
        }

        const row = db.prepare(query).get(...params);
        return !!row;
    }
}

/**
 * Set or update username for a user
 */
export async function setUsername(userId: string, username: string | null): Promise<{ success: boolean; error?: string }> {
    const dbType = getDbType();
    const normalizedUsername = username?.trim() || null;

    // Check if username is taken (if not clearing)
    if (normalizedUsername) {
        const exists = await checkUsernameExists(normalizedUsername, userId);
        if (exists) {
            return { success: false, error: 'This username is already taken' };
        }
    }

    if (dbType === 'postgres') {
        try {
            return await executeWithUser(userId, async (client) => {
                await client.query(`
                    INSERT INTO users(id, name, updated_at)
        VALUES($1, $2, NOW())
                    ON CONFLICT(id) DO UPDATE SET name = $2, updated_at = NOW()
            `, [userId, normalizedUsername]);
                return { success: true };
            });
        } catch (error: any) {
            if (error?.code === '23505') { // Unique violation
                return { success: false, error: 'This username is already taken' };
            }
            throw error;
        }
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('users')
            .upsert({
                id: userId,
                user_id: userId,
                username: normalizedUsername,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            if (error.code === '23505') {
                return { success: false, error: 'This username is already taken' };
            }
            throw error;
        }
        return { success: true };
    } else {
        const db = getSQLiteDB();
        try {
            db.prepare(`
                INSERT INTO users(id, name, updated_at)
        VALUES(?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')
            `).run(userId, normalizedUsername);
            return { success: true };
        } catch (error: any) {
            if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, error: 'This username is already taken' };
            }
            throw error;
        }
    }
}

/**
 * Ensure user exists with a username (auto-generate if needed)
 * Used on first sign-in
 */
export async function ensureUserWithUsername(userId: string, generateFn: () => string): Promise<string | null> {
    // Check if user already has a username
    const existingProfile = await getUserProfile(userId);
    if (existingProfile?.name) {
        return existingProfile.name;
    }

    // Generate unique username with retry logic
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
        const newUsername = generateFn();
        const result = await setUsername(userId, newUsername);
        if (result.success) {
            return newUsername;
        }
        // Username was taken, retry with a new one
    }

    // Failed to generate unique username after max retries
    console.error(`Failed to generate unique username for user ${userId} after ${maxRetries} attempts`);
    return null;
}

// ... existing imports

export async function logInteraction(
    userId: string,
    jobId: string,
    interactionType: string,
    metadata: any = {}
): Promise<void> {
    // Fire and forget: Update User Preference Profile
    updateUserEmbedding(userId, jobId, interactionType).catch(err => console.error('Background embedding update failed', err));

    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        // Fire and forget - don't await strictly if we want speed, but for correctness let's await
        // Using direct query since prisma might be overkill for just this log, but we want to stick to pattern
        await pool.query(`
            INSERT INTO user_interactions(user_id, job_id, interaction_type, metadata)
        VALUES($1, $2, $3, $4)
            `, [userId, jobId, interactionType, JSON.stringify(metadata)]);
    }
    // ... we can support other DBs if needed, but requirements focus on Postgres
}

// ============================================================================
// SEARCH DATABASE OPERATIONS
// ============================================================================

import type { SearchFilters } from '@/lib/search/types';

/**
 * Get search suggestions for autocomplete
 * Returns distinct titles, companies, and locations matching the query
 */
export async function getSearchSuggestions(
    query: string,
    limit: number = 10
): Promise<{ titles: string[]; companies: string[]; locations: string[] }> {
    const dbType = getDbType();
    const results = {
        titles: [] as string[],
        companies: [] as string[],
        locations: [] as string[]
    };

    if (dbType !== 'postgres') {
        return results;
    }

    const pool = getPostgresPool();
    const normalizedQuery = query.toLowerCase().trim();

    try {
        // Title suggestions
        const titleResult = await pool.query(`
            SELECT DISTINCT title
            FROM jobs
            WHERE title_normalized ILIKE $1
            ORDER BY 
                CASE WHEN title_normalized = $2 THEN 0 ELSE 1 END,
                title
            LIMIT $3
        `, [`%${normalizedQuery}%`, normalizedQuery, limit]);
        results.titles = titleResult.rows.map(r => r.title);

        // Company suggestions
        const companyResult = await pool.query(`
            SELECT DISTINCT company
            FROM jobs
            WHERE company_normalized ILIKE $1
            ORDER BY 
                CASE WHEN company_normalized = $2 THEN 0 ELSE 1 END,
                company
            LIMIT $3
        `, [`%${normalizedQuery}%`, normalizedQuery, limit]);
        results.companies = companyResult.rows.map(r => r.company).filter(Boolean);

        // Location suggestions
        const locationResult = await pool.query(`
            SELECT DISTINCT location
            FROM jobs
            WHERE location_normalized ILIKE $1
            ORDER BY 
                CASE WHEN location_normalized = $2 THEN 0 ELSE 1 END,
                location
            LIMIT $3
        `, [`%${normalizedQuery}%`, normalizedQuery, limit]);
        results.locations = locationResult.rows.map(r => r.location).filter(Boolean);

    } catch (error) {
        console.error('[DB] Search suggestions error:', error);
    }

    return results;
}

/**
 * Log search analytics for monitoring and improvement
 */
export async function logSearchAnalytics(
    query: string,
    resultsCount: number,
    searchDurationMs: number,
    filters?: SearchFilters,
    userId?: string,
    clickedJobId?: string
): Promise<void> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return;
    }

    const pool = getPostgresPool();

    try {
        await pool.query(`
            INSERT INTO search_analytics (
                query_text, 
                query_normalized, 
                results_count, 
                clicked_job_id, 
                user_id,
                search_duration_ms, 
                filters_used,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            query,
            query.toLowerCase().trim(),
            resultsCount,
            clickedJobId || null,
            userId || null,
            searchDurationMs,
            filters ? JSON.stringify(filters) : null
        ]);
    } catch (error) {
        // Fail silently - analytics should not break search
        console.error('[DB] Failed to log search analytics:', error);
    }
}

/**
 * Vote on a job (upvote/downvote)
 */
export async function voteJob(
    userId: string,
    jobId: string,
    voteType: 'upvote' | 'downvote'
): Promise<{ success: boolean; upvotes: number; downvotes: number }> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return { success: false, upvotes: 0, downvotes: 0 };
    }

    const pool = getPostgresPool();

    try {
        const result = await pool.query(`
            UPDATE user_jobs
            SET
                upvotes = CASE
                    WHEN $1 = 'upvote' THEN upvotes + 1
                    WHEN $1 = 'downvote' THEN upvotes
                    ELSE upvotes
                END,
                downvotes = CASE
                    WHEN $1 = 'upvote' THEN downvotes
                    WHEN $1 = 'downvote' THEN downvotes + 1
                    ELSE downvotes
                END,
                updated_at = NOW()
            WHERE user_id = $2 AND job_id = $3
            RETURNING upvotes, downvotes
        `, [voteType, userId, jobId]);

        return {
            success: true,
            upvotes: result.rows[0].upvotes,
            downvotes: result.rows[0].downvotes
        };
    } catch (error: unknown) {
        console.error('[DB] Vote error:', error);
        return { success: false, upvotes: 0, downvotes: 0 };
    }
}

/**
 * Get vote counts for a job by specific user
 */
export async function getJobVotes(
    userId: string,
    jobId: string
): Promise<{ upvotes: number; downvotes: number } | null> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return null;
    }

    const pool = getPostgresPool();

    try {
        const result = await pool.query(
            'SELECT upvotes, downvotes FROM user_jobs WHERE user_id = $1 AND job_id = $2',
            [userId, jobId]
        );

        return result.rows[0] || null;
    } catch (error: unknown) {
        console.error('[DB] Get vote error:', error);
        return null;
    }
}

/**
 * Get posted by user info for a job
 */
export async function getPostedByUserInfo(jobId: string): Promise<{
    userId: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
} | null> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return null;
    }

    const pool = getPostgresPool();

    try {
        const result = await pool.query(`
            SELECT
                u.id as user_id,
                u.first_name as first_name,
                u.last_name as last_name,
                u.image_url as image_url
            FROM users u
            JOIN jobs j ON u.id = j.posted_by_user_id
            WHERE j.id = $1
        `, [jobId]);

        return result.rows[0] || null;
    } catch (error: unknown) {
        console.error('[DB] Get posted by user error:', error);
        return null;
    }
}

/**
 * Get popular search queries (for analytics dashboard)
 */
export async function getPopularSearches(
    limit: number = 20,
    days: number = 7
): Promise<Array<{ query: string; count: number }>> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return [];
    }

    const pool = getPostgresPool();

    try {
        const result = await pool.query(`
            SELECT query_normalized as query, COUNT(*) as count
            FROM search_analytics
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY query_normalized
            ORDER BY count DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    } catch (error) {
        console.error('[DB] Popular searches error:', error);
        return [];
    }
}

/**
 * Record a job click from search results
 * Used for click-through rate analysis and relevance feedback
 */
export async function recordSearchClick(
    searchQuery: string,
    jobId: string,
    userId?: string
): Promise<void> {
    const dbType = getDbType();

    if (dbType !== 'postgres') {
        return;
    }

    const pool = getPostgresPool();

    try {
        // Update the search analytics record with the clicked job
        await pool.query(`
            UPDATE search_analytics
            SET clicked_job_id = $1
            WHERE query_text = $2
            AND user_id = $3
            AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 1
        `, [jobId, searchQuery, userId || null]);
    } catch (error) {
        console.error('[DB] Failed to record search click:', error);
    }
}
