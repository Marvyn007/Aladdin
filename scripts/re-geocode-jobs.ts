
import { resolveLocation } from '../src/lib/geocoding';
import { getPostgresPool } from '../src/lib/postgres';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Starting Re-geocoding Cleanup ---');

    // Find jobs that have suspicious geocoding
    // Case 1: SF jobs in San Diego (Lat ~32.x)
    const suspiciousJobs = await prisma.job.findMany({
        where: {
            geoResolved: true,
            location: {
                contains: 'San Francisco',
                mode: 'insensitive'
            },
            geoPoints: {
                some: {
                    latitude: {
                        lt: 34.0 // San Diego is around 32, SF is around 37
                    }
                }
            }
        },
        select: {
            id: true,
            location: true,
            company: true
        }
    });

    console.log(`Found ${suspiciousJobs.length} suspicious jobs for San Francisco.`);

    for (const job of suspiciousJobs) {
        console.log(`Re-resolving Job ID: ${job.id} (${job.location})`);
        // Reset geo_resolved to false first if necessary, but resolveLocation does its own checks
        const success = await resolveLocation(job.id, job.location || '', job.company);
        console.log(`  Result: ${success ? 'SUCCESS' : 'FAILED'}`);
    }

    // Case 2: General "too far" check if we want to be aggressive, 
    // but the filter above is a good start for the user's specific complaint.
    
    console.log('--- Cleanup Complete ---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
