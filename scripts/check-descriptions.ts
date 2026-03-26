import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.job.groupBy({
    by: ['source'],
    _count: {
      id: true,
    },
  });

  console.log('Total jobs by source:', sources);

  const missingDescriptions = await prisma.job.groupBy({
    by: ['source'],
    where: {
      OR: [
        { jobDescriptionPlain: null },
        { jobDescriptionPlain: '' },
        { rawDescriptionHtml: null },
        { rawDescriptionHtml: '' }
      ]
    },
    _count: {
      id: true,
    },
  });

  console.log('\nJobs missing descriptions by source:', missingDescriptions);

  // Let's get a few examples of arbeitnow to see if they are in German
  const arbeitnowJobs = await prisma.job.findMany({
    where: { source: 'arbeitnow' },
    select: { title: true, jobDescriptionPlain: true, sourceUrl: true },
    take: 3
  });

  console.log('\nExamples from arbeitnow (checking language):');
  arbeitnowJobs.forEach(j => {
    console.log(`Title: ${j.title}`);
    console.log(`URL: ${j.sourceUrl}`);
    console.log(`Desc Sample: ${j.jobDescriptionPlain?.substring(0, 150)}...\n`);
  });

  const greenhouseJobs = await prisma.job.findMany({
    where: { source: 'greenhouse', jobDescriptionPlain: null },
    select: { title: true, sourceUrl: true },
    take: 3
  });

  console.log('\nExamples from greenhouse missing descriptions:');
  console.log(greenhouseJobs);

}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
