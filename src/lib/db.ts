// Database abstraction layer - supports both Supabase and SQLite
// Automatically selects the appropriate backend based on configuration

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { getSQLiteDB, isSQLiteConfigured, archiveOldJobs as sqliteArchive, purgeOldArchives as sqlitePurge } from './sqlite';
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

// Determine which database to use
export function getDbType(): 'supabase' | 'sqlite' {
    if (isSQLiteConfigured()) return 'sqlite';
    if (isSupabaseConfigured()) return 'supabase';
    throw new Error('No database configured. Set either SUPABASE_URL/SUPABASE_KEY or USE_SQLITE=true');
}

// Generate content hash for deduplication
export function generateContentHash(title: string, company: string | null, location: string | null, text: string): string {
    const normalized = `${title}|${company || ''}|${location || ''}|${text}`.toLowerCase().trim();
    return CryptoJS.SHA256(normalized).toString();
}

// ============================================================================
// JOBS OPERATIONS
// ============================================================================

export async function getJobs(status: 'fresh' | 'archived' = 'fresh', limit: number = 300): Promise<Job[]> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .eq('status', status)
            .order('match_score', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as Job[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare(`
      SELECT * FROM jobs 
      WHERE status = ? 
      ORDER BY match_score DESC 
      LIMIT ?
    `).all(status, limit) as Record<string, unknown>[];

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

export async function getJobById(id: string): Promise<Job | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data as Job;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;

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

export async function insertJob(job: Omit<Job, 'id' | 'fetched_at' | 'status' | 'match_score' | 'matched_skills' | 'missing_skills' | 'why' | 'content_hash'>): Promise<Job> {
    const dbType = getDbType();
    const id = uuidv4();
    const contentHash = generateContentHash(job.title, job.company, job.location, job.normalized_text || '');

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('jobs')
            .insert({
                id,
                ...job,
                content_hash: contentHash,
                status: 'fresh',
                match_score: 0,
                is_imported: job.isImported ? 1 : 0,
                original_posted_date: job.original_posted_date,
                original_posted_raw: job.original_posted_raw,
                original_posted_source: job.original_posted_source,
                location_display: job.location_display,
                import_tag: job.import_tag,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('Duplicate job detected');
            }
            throw error;
        }
        return data as Job;
    } else {
        const db = getSQLiteDB();
        try {
            db.prepare(`
        INSERT INTO jobs (
          id, title, company, location, source_url, posted_at, 
          normalized_text, raw_text_summary, content_hash, status, 
          match_score, is_imported, original_posted_date, 
          original_posted_raw, original_posted_source, location_display, import_tag,
          raw_description_html, job_description_plain, date_posted_iso,
          date_posted_display, date_posted_relative, source_host, scraped_at, extraction_confidence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'fresh', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                id,
                job.title,
                job.company,
                job.location,
                job.source_url,
                job.posted_at,
                job.normalized_text,
                job.raw_text_summary,
                contentHash,
                job.isImported ? 1 : 0,
                job.original_posted_date || null,
                job.original_posted_raw || null,
                job.original_posted_source || null,
                job.location_display || null,
                job.import_tag || null,
                // V2 fields
                job.raw_description_html || null,
                job.job_description_plain || null,
                job.date_posted_iso || null,
                job.date_posted_display || null,
                job.date_posted_relative ? 1 : 0,
                job.source_host || null,
                job.scraped_at || null,
                job.extraction_confidence ? JSON.stringify(job.extraction_confidence) : null
            );

            return await getJobById(id) as Job;
        } catch (err: unknown) {
            if ((err as Error).message?.includes('UNIQUE constraint')) {
                throw new Error('Duplicate job detected');
            }
            throw err;
        }
    }
}

export async function updateJobScore(
    jobId: string,
    matchScore: number,
    matchedSkills: string[],
    missingSkills: string[],
    why: string
): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('jobs')
            .update({
                match_score: matchScore,
                matched_skills: matchedSkills,
                missing_skills: missingSkills,
                why,
            })
            .eq('id', jobId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      UPDATE jobs 
      SET match_score = ?, matched_skills = ?, missing_skills = ?, why = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(matchScore, JSON.stringify(matchedSkills), JSON.stringify(missingSkills), why, jobId);
    }
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const updateData: { status: JobStatus; archived_at?: string | null } = { status };

        // Set archived_at when archiving, clear it when unarchiving
        if (status === 'archived') {
            updateData.archived_at = new Date().toISOString();
        } else {
            updateData.archived_at = null;
        }

        const { error } = await client
            .from('jobs')
            .update(updateData)
            .eq('id', jobId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        if (status === 'archived') {
            db.prepare('UPDATE jobs SET status = ?, archived_at = datetime("now"), updated_at = datetime("now") WHERE id = ?').run(status, jobId);
        } else {
            db.prepare('UPDATE jobs SET status = ?, archived_at = NULL, updated_at = datetime("now") WHERE id = ?').run(status, jobId);
        }
    }
}

export async function deleteJob(jobId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
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

export async function getResumes(): Promise<Resume[]> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('id, filename, upload_at, parsed_json, is_default')
            .order('upload_at', { ascending: false });

        if (error) throw error;
        return data as Resume[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT id, filename, upload_at, parsed_json, is_default FROM resumes ORDER BY upload_at DESC').all() as Record<string, unknown>[];
        return rows.map((row) => ({
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        })) as Resume[];
    }
}

export async function getDefaultResume(): Promise<Resume | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('*')
            .eq('is_default', true)
            .single();

        if (error) return null;
        return data as Resume;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM resumes WHERE is_default = 1').get() as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        } as Resume;
    }
}

export async function insertResume(filename: string, parsedJson: ParsedResume, isDefault: boolean, fileData?: Buffer): Promise<Resume> {
    const dbType = getDbType();
    const id = uuidv4();

    // If setting as default, unset other defaults first
    if (isDefault) {
        await clearDefaultResume();
    }

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .insert({
                id,
                filename,
                parsed_json: parsedJson as unknown as Record<string, unknown>,
                is_default: isDefault,
                file_data: fileData ? fileData.toString('base64') : null,
            })
            .select()
            .single();

        if (error) throw error;
        return data as Resume;
    } else {
        const db = getSQLiteDB();
        db.prepare(`
      INSERT INTO resumes (id, filename, parsed_json, is_default, file_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, filename, JSON.stringify(parsedJson), isDefault ? 1 : 0, fileData || null);

        const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as Record<string, unknown>;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
            is_default: Boolean(row.is_default),
        } as Resume;
    }

}

export async function updateResume(id: string, updates: Partial<Resume>): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const dbUpdates: any = {};
        if (updates.parsed_json !== undefined) dbUpdates.parsed_json = updates.parsed_json;
        if (updates.filename !== undefined) dbUpdates.filename = updates.filename;
        if (updates.is_default !== undefined) dbUpdates.is_default = updates.is_default;

        const { error } = await client
            .from('resumes')
            .update(dbUpdates)
            .eq('id', id);

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
            db.prepare(`UPDATE resumes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        }
    }
}

export async function getResumeById(id: string): Promise<{ resume: Resume; file_data: Buffer | null } | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('resumes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return {
            resume: {
                id: data.id,
                filename: data.filename,
                upload_at: data.upload_at,
                parsed_json: data.parsed_json,
                is_default: data.is_default,
            } as Resume,
            file_data: data.file_data ? Buffer.from(data.file_data, 'base64') : null,
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as Record<string, unknown> | undefined;

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

export async function deleteResume(id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resumes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
    }
}

export async function setDefaultResume(resumeId: string): Promise<void> {
    await clearDefaultResume();

    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('resumes')
            .update({ is_default: true })
            .eq('id', resumeId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE resumes SET is_default = 1 WHERE id = ?').run(resumeId);
    }
}

async function clearDefaultResume(): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        await client.from('resumes').update({ is_default: false }).eq('is_default', true);
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE resumes SET is_default = 0 WHERE is_default = 1').run();
    }
}

// ============================================================================
// LINKEDIN PROFILES OPERATIONS
// ============================================================================

export async function getLinkedInProfile(): Promise<LinkedInProfile | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .order('upload_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;
        return data as LinkedInProfile;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM linkedin_profiles ORDER BY upload_at DESC LIMIT 1').get() as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
        } as LinkedInProfile;
    }
}

export async function insertLinkedInProfile(filename: string, parsedJson: ParsedResume, fileData?: Buffer): Promise<LinkedInProfile> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .insert({
                id,
                filename,
                parsed_json: parsedJson as unknown as Record<string, unknown>,
                file_data: fileData ? fileData.toString('base64') : null,
            })
            .select()
            .single();

        if (error) throw error;
        return data as LinkedInProfile;
    } else {
        const db = getSQLiteDB();
        const stmt = db.prepare('INSERT INTO linkedin_profiles (id, filename, parsed_json, file_data) VALUES (?, ?, ?, ?) RETURNING *');
        const row = stmt.get(id, filename, JSON.stringify(parsedJson), fileData) as Record<string, unknown>;
        return {
            ...row,
            parsed_json: typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json,
        } as LinkedInProfile;
    }
}

export async function getAllLinkedInProfiles(): Promise<LinkedInProfile[]> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .order('upload_at', { ascending: false });

        if (error) {
            console.error('Error fetching linkedin profiles:', error);
            return [];
        }
        return data as LinkedInProfile[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT * FROM linkedin_profiles ORDER BY upload_at DESC').all() as Record<string, unknown>[];

        return rows.map(row => ({
            ...row,
            parsed_json: row.parsed_json ? JSON.parse(row.parsed_json as string) : null,
        })) as LinkedInProfile[];
    }
}

export async function deleteLinkedInProfile(id: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client.from('linkedin_profiles').delete().eq('id', id);
        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('DELETE FROM linkedin_profiles WHERE id = ?').run(id);
    }
}

export async function getLinkedInProfileById(id: string): Promise<{ profile: LinkedInProfile; file_data: Buffer | null } | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('linkedin_profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return {
            profile: {
                id: data.id,
                filename: data.filename,
                upload_at: data.upload_at,
                parsed_json: data.parsed_json,
            } as LinkedInProfile,
            file_data: data.file_data ? Buffer.from(data.file_data, 'base64') : null,
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM linkedin_profiles WHERE id = ?').get(id) as Record<string, unknown> | undefined;

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

export async function getApplications(): Promise<Application[]> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .select('*')
            .eq('deleted', false)
            .order('applied_at', { ascending: false });

        if (error) throw error;
        return data as Application[];
    } else {
        const db = getSQLiteDB();
        const rows = db.prepare('SELECT * FROM applications WHERE deleted = 0 ORDER BY applied_at DESC').all() as Record<string, unknown>[];
        return rows.map((row) => ({
            ...row,
            deleted: Boolean(row.deleted),
        })) as Application[];
    }
}

export async function getApplicationByJobId(jobId: string): Promise<Application | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .select('*')
            .eq('job_id', jobId)
            .eq('deleted', false)
            .single();

        if (error) return null;
        return data as Application;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM applications WHERE job_id = ? AND deleted = 0').get(jobId) as Record<string, unknown> | undefined;

        if (!row) return null;
        return {
            ...row,
            deleted: Boolean(row.deleted),
        } as Application;
    }
}

export async function createApplication(jobId: string, externalLink: string): Promise<Application> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('applications')
            .insert({
                id,
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
      INSERT INTO applications (id, job_id, column_name, external_link)
      VALUES (?, ?, 'Applied', ?)
    `).run(id, jobId, externalLink);

        const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Record<string, unknown>;
        return {
            ...row,
            deleted: Boolean(row.deleted),
        } as Application;
    }
}

export async function updateApplicationColumn(applicationId: string, column: ApplicationColumn): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('applications')
            .update({ column_name: column })
            .eq('id', applicationId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`UPDATE applications SET column_name = ?, updated_at = datetime('now') WHERE id = ?`).run(column, applicationId);
    }
}

export async function deleteApplication(applicationId: string): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('applications')
            .update({ deleted: true })
            .eq('id', applicationId);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare(`UPDATE applications SET deleted = 1, updated_at = datetime('now') WHERE id = ?`).run(applicationId);
    }
}

// ============================================================================
// COVER LETTERS OPERATIONS
// ============================================================================

export async function insertCoverLetter(
    jobId: string,
    resumeId: string | null,
    contentHtml: string | null,
    contentText: string | null,
    status: 'pending' | 'generated' | 'failed' = 'generated'
): Promise<CoverLetter> {
    const dbType = getDbType();
    const id = uuidv4();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .insert({
                id,
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
      INSERT INTO cover_letters (id, job_id, resume_id, content_html, content_text, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, jobId, resumeId, contentHtml, contentText, status);

        const row = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(id) as Record<string, unknown>;
        return row as unknown as CoverLetter;
    }
}

export async function updateCoverLetter(id: string, updates: Partial<CoverLetter>): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('cover_letters')
            .update(updates)
            .eq('id', id);

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

        if (sets.length > 0) {
            values.push(id);
            db.prepare(`UPDATE cover_letters SET ${sets.join(', ')}, generated_at = datetime('now') WHERE id = ?`).run(...values);
        }
    }
}

// Helper to get pending cover letters
export async function getPendingCoverLetters(limit: number = 5): Promise<Array<{ id: string, job_id: string, resume_id: string | null }>> {
    const dbType = getDbType();
    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .select('id, job_id, resume_id')
            .eq('status', 'pending')
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
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT ?
    `).all(limit) as Array<{ id: string, job_id: string, resume_id: string | null }>;
        return rows;
    }
}

export async function getCoverLetterById(id: string): Promise<CoverLetter | null> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('cover_letters')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data as CoverLetter;
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT * FROM cover_letters WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        if (!row) return null;
        return row as unknown as CoverLetter;
    }
}

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================

export async function getSettings(): Promise<{ freshLimit: number; lastUpdated: string | null }> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('app_settings')
            .select('fresh_limit, last_updated')
            .single();

        if (error) return { freshLimit: 300, lastUpdated: null };
        return {
            freshLimit: data.fresh_limit,
            lastUpdated: data.last_updated
        };
    } else {
        const db = getSQLiteDB();
        const row = db.prepare('SELECT fresh_limit, last_updated FROM app_settings WHERE id = 1').get() as Record<string, unknown> | undefined;

        if (!row) return { freshLimit: 300, lastUpdated: null };
        return {
            freshLimit: row.fresh_limit as number,
            lastUpdated: row.last_updated as string | null
        };
    }
}

export async function updateSettings(freshLimit: number): Promise<void> {
    const dbType = getDbType();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('app_settings')
            .update({ fresh_limit: freshLimit })
            .eq('id', 1);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE app_settings SET fresh_limit = ? WHERE id = 1').run(freshLimit);
    }
}

export async function updateLastUpdated(): Promise<void> {
    const dbType = getDbType();
    const now = new Date().toISOString();

    if (dbType === 'supabase') {
        const client = getSupabaseClient();
        const { error } = await client
            .from('app_settings')
            .update({ last_updated: now })
            .eq('id', 1);

        if (error) throw error;
    } else {
        const db = getSQLiteDB();
        db.prepare('UPDATE app_settings SET last_updated = ? WHERE id = 1').run(now);
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
    if (dbType === 'supabase') {
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
    if (dbType === 'supabase') {
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

