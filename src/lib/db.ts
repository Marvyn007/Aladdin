// Database abstraction layer - supports both Supabase and SQLite
// Automatically selects the appropriate backend based on configuration

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { getSQLiteDB, isSQLiteConfigured, archiveOldJobs as sqliteArchive, purgeOldArchives as sqlitePurge } from './sqlite';
import { getPostgresPool, isPostgresConfigured } from './postgres';
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

// Fail-fast check on module load (will run when server starts)
checkRequiredEnv();

// Determine which database to use
// Determine which database to use
export type DatabaseType = 'postgres' | 'supabase' | 'sqlite';

export function getDbType(): DatabaseType {
    // Explicit override for restricted networks (firewall blocking port 5432)
    if (process.env.USE_SUPABASE_REST === 'true' && isSupabaseConfigured()) {
        return 'supabase';
    }

    if (isPostgresConfigured()) return 'postgres';
    if (isSupabaseConfigured()) return 'supabase';
    if (isSQLiteConfigured()) return 'sqlite';
    throw new Error('No database configured. Set DATABASE_URL, SUPABASE_URL/KEY, or USE_SQLITE=true');
}

// Generate content hash for deduplication
export function generateContentHash(title: string, company: string | null, location: string | null, text: string): string {
    const normalized = `${title}|${company || ''}|${location || ''}|${text}`.toLowerCase().trim();
    return CryptoJS.SHA256(normalized).toString();
}

// ============================================================================
// JOBS OPERATIONS
// ============================================================================

/**
 * Get ALL public jobs with pagination (no user filtering)
 * Stable ordering: fetched_at DESC, id for consistent pagination
 */
export async function getAllPublicJobs(page: number = 1, limit: number = 50): Promise<Job[]> {
    const dbType = getDbType();
    const offset = (page - 1) * limit;

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query(
            `SELECT * FROM jobs 
             ORDER BY fetched_at DESC NULLS LAST, id 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return res.rows.map(row => ({
            ...row,
            matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills,
            missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
        })) as Job[];
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .order('fetched_at', { ascending: false, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + limit - 1);

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
            ORDER BY fetched_at DESC, id 
            LIMIT ? OFFSET ?
        `).all(limit, offset) as Record<string, unknown>[];

        return rows.map((row) => ({
            ...row,
            matched_skills: row.matched_skills ? JSON.parse(row.matched_skills as string) : null,
            missing_skills: row.missing_skills ? JSON.parse(row.missing_skills as string) : null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: row.extraction_confidence ? JSON.parse(row.extraction_confidence as string) : null,
        })) as Job[];
    }
}

/**
 * Get total count of ALL public jobs (for pagination UI)
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

export async function getJobs(userId: string, status: 'fresh' | 'archived' = 'fresh', limit: number = 300): Promise<Job[]> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query(
            `SELECT j.*, uj.status, uj.match_score, uj.matched_skills, uj.missing_skills, uj.why, uj.archived_at
             FROM user_jobs uj
             JOIN jobs j ON uj.job_id = j.id
             WHERE uj.user_id = $1 AND uj.status = $2
             ORDER BY uj.match_score DESC LIMIT $3`,
            [userId, status, limit]
        );
        return res.rows.map(row => ({
            ...row,
            matched_skills: typeof row.matched_skills === 'string' ? JSON.parse(row.matched_skills) : row.matched_skills,
            missing_skills: typeof row.missing_skills === 'string' ? JSON.parse(row.missing_skills) : row.missing_skills,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: typeof row.extraction_confidence === 'string' ? JSON.parse(row.extraction_confidence) : row.extraction_confidence,
        })) as Job[];
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('user_jobs')
            .select(`
                status, match_score, matched_skills, missing_skills, why, archived_at,
                jobs:job_id (*)
            `)
            .eq('user_id', userId)
            .eq('status', status)
            .order('match_score', { ascending: false })
            .limit(limit);

        if (error) throw error;
        // Flatten the result
        return (data || []).map((row: any) => ({
            ...row.jobs,
            ...row, // Overwrite with user-specific data (status, score)
            matched_skills: row.matched_skills, // Already parsed by Supabase client usually
            missing_skills: row.missing_skills,
            isImported: Boolean(row.jobs.is_imported),
            date_posted_relative: Boolean(row.jobs.date_posted_relative),
        })) as Job[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare(`
            SELECT j.*, uj.status, uj.match_score, uj.matched_skills, uj.missing_skills, uj.why, uj.archived_at
            FROM user_jobs uj
            JOIN jobs j ON uj.job_id = j.id
            WHERE uj.user_id = ? AND uj.status = ?
            ORDER BY uj.match_score DESC LIMIT ?
        `).all(userId, status, limit) as Record<string, unknown>[];

        return rows.map((row) => ({
            ...row,
            matched_skills: row.matched_skills ? JSON.parse(row.matched_skills as string) : null,
            missing_skills: row.missing_skills ? JSON.parse(row.missing_skills as string) : null,
            isImported: Boolean(row.is_imported),
            date_posted_relative: Boolean(row.date_posted_relative),
            extraction_confidence: row.extraction_confidence ? JSON.parse(row.extraction_confidence as string) : null,
        })) as Job[];
    }
}

export async function getJobById(userId: string | null, id: string): Promise<Job | null> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        let query = 'SELECT * FROM jobs WHERE id = $1';
        let params: any[] = [id];

        if (userId) {
            query = `
                SELECT j.*, uj.status, uj.match_score, uj.matched_skills, uj.missing_skills, uj.why, uj.archived_at
                FROM jobs j
                LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = $2
                WHERE j.id = $1
            `;
            params = [id, userId];
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

export async function insertJob(userId: string, job: Omit<Job, 'id' | 'fetched_at' | 'status' | 'match_score' | 'matched_skills' | 'missing_skills' | 'why' | 'content_hash'>): Promise<Job> {
    const dbType = getDbType();
    const contentHash = generateContentHash(job.title, job.company, job.location, job.normalized_text || '');
    let jobId: string | null = null;

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
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
                    date_posted_display, date_posted_relative, source_host, scraped_at, extraction_confidence
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            `, [
                jobId, job.title, job.company, job.location, job.source_url, job.posted_at,
                job.normalized_text, job.raw_text_summary, contentHash, job.isImported ? 1 : 0,
                job.original_posted_date || null, job.original_posted_raw || null, job.original_posted_source || null,
                job.location_display || null, job.import_tag || null,
                job.raw_description_html || null, job.job_description_plain || null, job.date_posted_iso || null,
                job.date_posted_display || null, job.date_posted_relative ? 1 : 0,
                job.source_host || null, job.scraped_at || null,
                job.extraction_confidence ? JSON.stringify(job.extraction_confidence) : null
            ]);
        }

        // 2. Insert User Job linkage
        await pool.query(`
            INSERT INTO user_jobs (user_id, job_id, status, match_score)
            VALUES ($1, $2, 'fresh', 0)
            ON CONFLICT (user_id, job_id) DO NOTHING
        `, [userId, jobId]);

        // Return full job (simplification: returning input + id)
        // Ideally fetch full joined row, but for import this is enough context.
        return { ...job, id: jobId!, status: 'fresh', match_score: 0, matched_skills: null, missing_skills: null, why: null, content_hash: contentHash, fetched_at: new Date().toISOString() };

    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

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
            });
            if (insertError) throw insertError;
        }

        // 2. Link User
        const { error: linkError } = await client.from('user_jobs').upsert({
            user_id: userId,
            job_id: jobId,
            status: 'fresh',
            match_score: 0
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
                date_posted_display, date_posted_relative, source_host, scraped_at, extraction_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                jobId, job.title, job.company, job.location, job.source_url, job.posted_at,
                job.normalized_text, job.raw_text_summary, contentHash, job.isImported ? 1 : 0,
                job.original_posted_date || null, job.original_posted_raw || null, job.original_posted_source || null,
                job.location_display || null, job.import_tag || null,
                job.raw_description_html || null, job.job_description_plain || null, job.date_posted_iso || null,
                job.date_posted_display || null, job.date_posted_relative ? 1 : 0,
                job.source_host || null, job.scraped_at || null,
                job.extraction_confidence ? JSON.stringify(job.extraction_confidence) : null
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
        const pool = getPostgresPool();
        await pool.query(`
            UPDATE user_jobs
            SET match_score = $1, matched_skills = $2, missing_skills = $3, why = $4, updated_at = NOW()
            WHERE job_id = $5 AND user_id = $6
        `, [matchScore, JSON.stringify(matchedSkills), JSON.stringify(missingSkills), why, jobId, userId]);
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
        const pool = getPostgresPool();
        if (status === 'archived') {
            await pool.query('UPDATE user_jobs SET status = $1, archived_at = NOW(), updated_at = NOW() WHERE job_id = $2 AND user_id = $3', [status, jobId, userId]);
        } else {
            await pool.query('UPDATE user_jobs SET status = $1, archived_at = NULL, updated_at = NOW() WHERE job_id = $2 AND user_id = $3', [status, jobId, userId]);
        }
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
        const pool = getPostgresPool();
        // Only delete the user's reference (un-import/delete from feed)
        // Global job remains
        await pool.query('DELETE FROM user_jobs WHERE job_id = $1 AND user_id = $2', [jobId, userId]);
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT id, filename, upload_at, parsed_json, is_default, s3_key FROM resumes WHERE user_id = $1 ORDER BY upload_at DESC', [userId]);
        return res.rows.map(row => ({
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
            is_default: Boolean(row.is_default),
        })) as Resume[];
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
        const rows = db.prepare('SELECT id, filename, upload_at, parsed_json, is_default, file_data FROM resumes WHERE user_id = ? ORDER BY upload_at DESC').all(userId) as Record<string, unknown>[];
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM resumes WHERE is_default = TRUE AND user_id = $1', [userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
            is_default: Boolean(row.is_default),
        } as Resume;
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

        const pool = getPostgresPool();
        const res = await pool.query(`
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
        const pool = getPostgresPool();
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
            await pool.query(`UPDATE resumes SET ${sets.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1}`, values);
        }
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
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

export async function deleteResume(userId: string, id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        // Get key
        const res = await pool.query('SELECT s3_key FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows.length > 0 && res.rows[0].s3_key) {
            await deleteFileFromS3(res.rows[0].s3_key);
        }
        await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();

        // First get the key to delete from S3
        const { data } = await client.from('resumes').select('s3_key').eq('id', id).eq('user_id', userId).single();
        if (data?.s3_key) {
            await deleteFileFromS3(data.s3_key);
        }

        const { error } = await client
            .from('resumes')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM resumes WHERE id = ? AND user_id = ?').run(id, userId);
    }
}

export async function setDefaultResume(userId: string, resumeId: string): Promise<void> {
    await clearDefaultResume(userId);

    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        await pool.query('UPDATE resumes SET is_default = TRUE WHERE id = $1 AND user_id = $2', [resumeId, userId]);
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
        const pool = getPostgresPool();
        await pool.query('UPDATE resumes SET is_default = FALSE WHERE is_default = TRUE AND user_id = $1', [userId]);
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM linkedin_profiles WHERE user_id = $1 ORDER BY upload_at DESC LIMIT 1', [userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
        } as LinkedInProfile;
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

        const pool = getPostgresPool();
        const res = await pool.query(`
            INSERT INTO linkedin_profiles (id, user_id, filename, parsed_json, s3_key)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id, userId, filename, JSON.stringify(parsedJson), s3Key]);
        const row = res.rows[0];
        return {
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
        } as LinkedInProfile;
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM linkedin_profiles WHERE user_id = $1 ORDER BY upload_at DESC', [userId]);
        return res.rows.map(row => ({
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
        })) as LinkedInProfile[];
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
        const pool = getPostgresPool();
        // Remove from S3 first
        const res = await pool.query('SELECT s3_key FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows.length > 0 && res.rows[0].s3_key) {
            await deleteFileFromS3(res.rows[0].s3_key);
        }
        await pool.query('DELETE FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM linkedin_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM applications WHERE user_id = $1 AND deleted = FALSE ORDER BY applied_at DESC', [userId]);
        return res.rows.map(row => ({
            ...row,
            deleted: Boolean(row.deleted),
        })) as Application[];
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM applications WHERE job_id = $1 AND user_id = $2 AND deleted = FALSE', [jobId, userId]);
        if (res.rows.length === 0) return null;
        return {
            ...res.rows[0],
            deleted: Boolean(res.rows[0].deleted),
        } as Application;
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
        const pool = getPostgresPool();
        const res = await pool.query(`
            INSERT INTO applications (id, user_id, job_id, column_name, external_link)
            VALUES ($1, $2, $3, 'Applied', $4)
            RETURNING *
        `, [id, userId, jobId, externalLink]);
        return res.rows[0] as Application;
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
        const pool = getPostgresPool();
        await pool.query('UPDATE applications SET column_name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [column, applicationId, userId]);
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
        const pool = getPostgresPool();
        await pool.query('UPDATE applications SET deleted = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2', [applicationId, userId]);
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
        const pool = getPostgresPool();
        const res = await pool.query(`
            INSERT INTO cover_letters (id, user_id, job_id, resume_id, content_html, content_text, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [id, userId, jobId, resumeId, contentHtml, contentText, status]);
        return res.rows[0] as unknown as CoverLetter;
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
        const pool = getPostgresPool();
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
            await pool.query(`UPDATE cover_letters SET ${sets.join(', ')}, generated_at = NOW() WHERE id = $${idx} AND user_id = $${idx + 1}`, values);
        }
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
        const pool = getPostgresPool();
        const res = await pool.query(`
            SELECT id, job_id, resume_id 
            FROM cover_letters 
            WHERE status = 'pending' AND user_id = $1
            ORDER BY created_at ASC 
            LIMIT $2
        `, [userId, limit]);
        return res.rows as Array<{ id: string, job_id: string, resume_id: string | null }>;

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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM cover_letters WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows.length === 0) return null;

        const data = res.rows[0];
        if (data.s3_key) {
            const signedUrl = await getSignedDownloadUrl(data.s3_key);
            data.pdf_blob_url = signedUrl;
        }
        return data as CoverLetter;
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

export async function getSettings(userId: string): Promise<{ freshLimit: number; lastUpdated: string | null }> {
    const dbType = getDbType();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query('SELECT fresh_limit, last_updated FROM app_settings WHERE user_id = $1', [userId]);
        if (res.rows.length === 0) return { freshLimit: 300, lastUpdated: null };
        const row = res.rows[0];
        return {
            freshLimit: row.fresh_limit,
            lastUpdated: row.last_updated
        };
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('app_settings')
            .select('fresh_limit, last_updated')
            .eq('user_id', userId)
            .single();

        if (error) return { freshLimit: 300, lastUpdated: null };
        return {
            freshLimit: data.fresh_limit,
            lastUpdated: data.last_updated
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT fresh_limit, last_updated FROM app_settings WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;

        if (!row) return { freshLimit: 300, lastUpdated: null };
        return {
            freshLimit: row.fresh_limit as number,
            lastUpdated: row.last_updated as string | null
        };
    }
}

export async function updateSettings(userId: string, freshLimit: number): Promise<void> {
    const dbType = getDbType();

    // Ensure settings exist (upsert semantics)
    // We should probably do an UPSERT here.

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        await pool.query(`
            INSERT INTO app_settings (user_id, fresh_limit) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET fresh_limit = $2
        `, [userId, freshLimit]);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('app_settings')
            .upsert({ user_id: userId, fresh_limit: freshLimit }, { onConflict: 'user_id' });

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
            INSERT INTO app_settings (user_id, fresh_limit) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET fresh_limit = ?
        `).run(userId, freshLimit, freshLimit);
    }
}

export async function updateLastUpdated(userId: string): Promise<void> {
    const dbType = getDbType();
    const now = new Date().toISOString();

    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        await pool.query(`
            INSERT INTO app_settings (user_id, last_updated) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET last_updated = $2
        `, [userId, now]);
    } else if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('app_settings')
            .upsert({ user_id: userId, last_updated: now }, { onConflict: 'user_id' });

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
            INSERT INTO app_settings (user_id, last_updated) VALUES (?, ?)
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
    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const res = await pool.query('SELECT * FROM ai_provider_stats WHERE provider_name = $1', [providerName]);
        if (res.rows.length === 0) {
            await pool.query('INSERT INTO ai_provider_stats (provider_name) VALUES ($1) ON CONFLICT DO NOTHING', [providerName]);
            const res2 = await pool.query('SELECT * FROM ai_provider_stats WHERE provider_name = $1', [providerName]);
            return res2.rows[0] as AIProviderStats;
        }
        return res.rows[0] as AIProviderStats;
    } else if (dbType === 'supabase') {
        // Supabase migration not applied yet, assume in-memory fallback in router
        return null;
    } else {
        const db = getSQLiteDB();
        let row = db.prepare('SELECT * FROM ai_provider_stats WHERE provider_name = ?').get(providerName) as AIProviderStats | undefined;

        if (!row) {
            // Initialize if missing
            db.prepare('INSERT OR IGNORE INTO ai_provider_stats (provider_name) VALUES (?)').run(providerName);
            row = db.prepare('SELECT * FROM ai_provider_stats WHERE provider_name = ?').get(providerName) as AIProviderStats;
        }
        return row || null;
    }
}

export async function updateProviderStats(providerName: string, updates: Partial<AIProviderStats>): Promise<void> {
    const dbType = getDbType();
    if (dbType === 'postgres') {
        const pool = getPostgresPool();
        const fields = Object.keys(updates).filter(k => k !== 'provider_name');
        if (fields.length === 0) return;

        const setClause = fields.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = [providerName, ...fields.map(k => (updates as any)[k])];

        await pool.query(`UPDATE ai_provider_stats SET ${setClause}, updated_at = NOW() WHERE provider_name = $1`, values);
    } else if (dbType === 'supabase') {
        // No-op for now
        return;
    } else {
        const db = getSQLiteDB();
        const fields = Object.keys(updates).filter(k => k !== 'provider_name');
        if (fields.length === 0) return;

        const setClause = fields.map(k => `${k} = @${k}`).join(', ');

        try {
            db.prepare(`
                UPDATE ai_provider_stats 
                SET ${setClause}, updated_at = datetime('now') 
                WHERE provider_name = @provider_name
            `).run({ ...updates, provider_name: providerName });
        } catch (error) {
            console.error('[DB] Failed to update provider stats:', error);
        }
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
        const pool = getPostgresPool();
        await pool.query(`
            INSERT INTO resume_drafts (id, user_id, resume_data, job_id, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT(id) DO UPDATE SET
            resume_data = EXCLUDED.resume_data,
            job_id = EXCLUDED.job_id,
            updated_at = EXCLUDED.updated_at
         `, [id, userId, JSON.stringify(resumeData), jobId || null]);
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
            INSERT INTO resume_drafts (id, user_id, resume_data, job_id, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
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
        const pool = getPostgresPool();
        const res = await pool.query('SELECT resume_data FROM resume_drafts WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        return res.rows.map(row => typeof row.resume_data === 'string' ? JSON.parse(row.resume_data) : row.resume_data);
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
            `SELECT * FROM jobs ORDER BY fetched_at DESC LIMIT $1`,
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
            .order('fetched_at', { ascending: false })
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
        ORDER BY fetched_at DESC 
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
