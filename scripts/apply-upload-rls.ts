
import { getPostgresPool, closePostgresPool } from '../src/lib/postgres';
import dotenv from 'dotenv';
dotenv.config();

async function applyRLS() {
    const pool = getPostgresPool();
    console.log('Applying RLS policies for Uploads...');

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Resumes
            await client.query(`ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;`);
            await client.query(`DROP POLICY IF EXISTS "Resumes Isolation" ON resumes;`);
            await client.query(`
                CREATE POLICY "Resumes Isolation" ON resumes
                USING (user_id = current_setting('request.jwt.claim.sub', true)::text)
                WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::text);
            `);
            console.log('Applied RLS to resumes');

            // 2. LinkedIn Profiles
            await client.query(`ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;`);
            await client.query(`DROP POLICY IF EXISTS "LinkedIn Isolation" ON linkedin_profiles;`);
            await client.query(`
                CREATE POLICY "LinkedIn Isolation" ON linkedin_profiles
                USING (user_id = current_setting('request.jwt.claim.sub', true)::text)
                WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::text);
            `);
            console.log('Applied RLS to linkedin_profiles');

            // 3. Cover Letters (Bonus, for completeness)
            await client.query(`ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;`);
            await client.query(`DROP POLICY IF EXISTS "Cover Letters Isolation" ON cover_letters;`);
            await client.query(`
                CREATE POLICY "Cover Letters Isolation" ON cover_letters
                USING (user_id = current_setting('request.jwt.claim.sub', true)::text)
                WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::text);
            `);
            console.log('Applied RLS to cover_letters');

            await client.query('COMMIT');
            console.log('All upload RLS policies applied successfully.');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Failed to apply RLS:', e);
        process.exit(1);
    } finally {
        await closePostgresPool();
    }
}

applyRLS();
