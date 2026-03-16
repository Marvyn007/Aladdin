
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {


    const targetJobsColumns = ["'location_raw'", "'geocoded_at'", "'location_dedup_key'"];
    const jobsCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name IN (${targetJobsColumns.join(',')})
    `);
    console.log('Target Jobs columns found:', jobsCheck.map(c => c.column_name));

    const targetGeoPointsColumns = ["'source'", "'raw_location_text'", "'is_user_corrected'"];
    const geoPointsCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'job_geo_points' AND column_name IN (${targetGeoPointsColumns.join(',')})
    `);
    console.log('Target JobGeoPoints columns found:', geoPointsCheck.map(c => c.column_name));



    const jobsCount = await prisma.job.count();
    console.log('Total jobs:', jobsCount);

    const geoPointsCount = await prisma.jobGeoPoint.count();
    console.log('Total geo points:', geoPointsCount);

  } catch (e) {
    console.error('Error checking schema:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
