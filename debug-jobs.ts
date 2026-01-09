
import { getJobs } from './src/lib/db';

async function main() {
    try {
        console.log('Fetching fresh jobs...');
        const start = Date.now();
        const jobs = await getJobs('fresh', 10);
        console.log(`Fetched ${jobs.length} jobs in ${Date.now() - start}ms`);
        if (jobs.length > 0) {
            console.log('Sample job:', JSON.stringify(jobs[0], null, 2));
        }
    } catch (error) {
        console.error('Error fetching jobs:', error);
    }
}

main();
