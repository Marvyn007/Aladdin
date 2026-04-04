import { PrismaClient } from '@prisma/client';
import { GreenhouseAdapter } from '../src/lib/job-sources/adapters/greenhouse';
import { LeverAdapter } from '../src/lib/job-sources/adapters/lever';

const prisma = new PrismaClient();

async function auditSlugs() {
  console.log("--- Auditing Tracked Company Slugs ---");
  
  const companies = await prisma.trackedCompany.findMany({
    where: { isActive: true }
  });

  console.log(`Checking ${companies.length} active companies...`);

  const greenhouse = new GreenhouseAdapter();
  const lever = new LeverAdapter();

  for (const company of companies) {
    let isValid = false;
    try {
      if (company.ats === 'greenhouse') {
        const jobs = await greenhouse.poll({ type: 'company', slug: company.slug });
        isValid = true; // Even if 0 jobs, the endpoint exists
      } else if (company.ats === 'lever') {
        const jobs = await lever.poll({ type: 'company', slug: company.slug });
        isValid = true;
      } else {
        isValid = true; // Skip other ATSs for now
      }
    } catch (e: any) {
      if (e.message.includes('404')) {
        console.log(`❌ 404 Detected: ${company.name} (${company.slug} on ${company.ats}) -> Deactivating`);
        await prisma.trackedCompany.update({ 
          where: { id: company.id }, 
          data: { isActive: false } 
        });
      } else {
        console.log(`⚠️ Error for ${company.name}: ${e.message}`);
      }
    }
  }

  console.log("--- Audit Complete ---");
}

auditSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
