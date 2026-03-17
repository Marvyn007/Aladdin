
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const jobsWithPoints = await prisma.job.findMany({
        where: {
            geoResolved: true
        },
        include: {
            geoPoints: true
        },
        take: 20
    });

    console.log('--- Geocoded Jobs Audit ---');
    jobsWithPoints.forEach(job => {
        console.log(`Job ID: ${job.id}`);
        console.log(`Title: ${job.title}`);
        console.log(`Raw Location: ${job.location}`);
        console.log(`Geo Source: ${job.geoSource}`);
        console.log(`Geo Points:`);
        job.geoPoints.forEach(p => {
            console.log(`  - Label: ${p.locationLabel}, Lat: ${p.latitude}, Lng: ${p.longitude}, Confidence: ${p.confidence}`);
        });
        console.log('---------------------------');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
