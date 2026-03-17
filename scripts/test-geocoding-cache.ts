
import { resolveLocation } from '../src/lib/geocoding';
import { getPostgresPool } from '../src/lib/postgres';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing Geocoding Cache ---');

    // Pick an existing location that is definitely geocoded
    const existingJob = await prisma.job.findFirst({
        where: { geoResolved: true, location: { not: null } },
        select: { id: true, location: true, company: true }
    });

    if (!existingJob) {
        console.log('No geocoded jobs found to test with.');
        return;
    }

    console.log(`Testing with existing location: "${existingJob.location}" (${existingJob.company})`);

    // Create a temporary dummy job to resolve
    const dummyJob = await prisma.job.create({
        data: {
            title: 'Cache Test Job',
            company: existingJob.company,
            location: existingJob.location,
            sourceUrl: 'https://example.com/cache-test',
        }
    });

    console.log(`Created dummy job: ${dummyJob.id}`);

    // This should hit the cache
    console.log('Running resolveLocation (should hit cache)...');
    const start = Date.now();
    const success = await resolveLocation(dummyJob.id, dummyJob.location || '', dummyJob.company);
    const duration = Date.now() - start;

    console.log(`  Result: ${success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Duration: ${duration}ms`);

    // Clean up
    await prisma.job.delete({ where: { id: dummyJob.id } });
    console.log('Cleaned up dummy job.');
    
    console.log('--- Cache Test Complete ---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
