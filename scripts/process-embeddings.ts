import { getPostgresPool } from '../src/lib/postgres';
import { generateEmbedding } from '../src/lib/embeddings';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BATCH_SIZE = 10;
const SLEEP_MS = 10000;

async function processJobs() {
    const pool = getPostgresPool();

    // Find jobs without embeddings
    const res = await pool.query(`
        SELECT id, title, company, location, normalized_text, job_description_plain 
        FROM jobs 
        WHERE id NOT IN (SELECT job_id FROM job_embeddings)
        LIMIT $1
    `, [BATCH_SIZE]);

    if (res.rows.length === 0) return 0;

    console.log(`Found ${res.rows.length} jobs to embed...`);

    for (const job of res.rows) {
        try {
            // Construct text representation
            // Title is most important, then company, then description
            const parts = [
                job.title,
                job.company,
                job.location,
                job.normalized_text || job.job_description_plain || ''
            ];
            const text = parts.filter(Boolean).join(' ');

            const embedding = await generateEmbedding(text);
            const vectorStr = `[${embedding.join(',')}]`;

            await pool.query(`
                INSERT INTO job_embeddings (job_id, embedding)
                VALUES ($1, $2::vector)
                ON CONFLICT (job_id) DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()
            `, [job.id, vectorStr]);

            console.log(`  Processed job: ${job.title.substring(0, 30)}...`);
        } catch (err) {
            console.error(`  Failed job ${job.id}:`, err);
        }
    }
    return res.rows.length;
}

async function processResumes() {
    const pool = getPostgresPool();

    // Find resumes without embeddings
    const res = await pool.query(`
        SELECT id, parsed_json 
        FROM resumes 
        WHERE id NOT IN (SELECT resume_id FROM resume_embeddings)
        AND parsed_json IS NOT NULL
        LIMIT $1
    `, [BATCH_SIZE]);

    if (res.rows.length === 0) return 0;

    console.log(`Found ${res.rows.length} resumes to embed...`);

    for (const resume of res.rows) {
        try {
            const data = typeof resume.parsed_json === 'string'
                ? JSON.parse(resume.parsed_json)
                : resume.parsed_json;

            // Flatten resume to text
            const parts: string[] = [];

            // Skills
            if (data.skills && Array.isArray(data.skills)) {
                parts.push('Skills: ' + data.skills.map((s: any) => s.name || s).join(', '));
            }

            // Roles
            if (data.roles && Array.isArray(data.roles)) {
                parts.push(data.roles.map((r: any) => `${r.title} at ${r.company}: ${r.description}`).join(' '));
            }

            // Education
            if (data.education && Array.isArray(data.education)) {
                parts.push(data.education.map((e: any) => `${e.degree} from ${e.school}`).join(' '));
            }

            // Projects
            if (data.projects && Array.isArray(data.projects)) {
                parts.push(data.projects.map((p: any) => `${p.title}: ${p.description}`).join(' '));
            }

            const text = parts.join('\n');
            if (!text.trim()) {
                console.log(`  Skipping empty resume ${resume.id}`);
                continue;
            }

            const embedding = await generateEmbedding(text);
            const vectorStr = `[${embedding.join(',')}]`;

            await pool.query(`
                INSERT INTO resume_embeddings (resume_id, embedding)
                VALUES ($1, $2::vector)
                ON CONFLICT (resume_id) DO UPDATE SET embedding = EXCLUDED.embedding, created_at = NOW()
            `, [resume.id, vectorStr]);

            console.log(`  Processed resume ${resume.id}`);
        } catch (err) {
            console.error(`  Failed resume ${resume.id}:`, err);
        }
    }
    return res.rows.length;
}

async function main() {
    console.log("Starting Embedding Worker...");
    try {
        while (true) {
            const jobsCount = await processJobs();
            const resumesCount = await processResumes();

            if (jobsCount === 0 && resumesCount === 0) {
                // No work, sleep
                // console.log("No pending work, sleeping...");
                await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
            } else {
                // Yield briefly to not hog loop if sync
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    } catch (err) {
        console.error("Worker crashed:", err);
        process.exit(1);
    }
}

main();
