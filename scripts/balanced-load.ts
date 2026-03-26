import { resolveAdapter } from '../src/lib/job-sources/worker';
import { createWorkerDb } from '../src/lib/job-sources/worker-db';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LIMIT_PER_SOURCE = 5;

// Define specific targets. We use large ATS accounts for fresh job rotation.
const sources = [
  { type: 'greenhouse', slug: 'stripe', name: 'Stripe (Greenhouse)', isCompany: true },
  { type: 'greenhouse', slug: 'airbnb', name: 'Airbnb (Greenhouse)', isCompany: true },
  { type: 'lever', slug: 'tailscale', name: 'Tailscale (Lever)', isCompany: true },
  { type: 'arbeitnow', slug: '', name: 'Arbeitnow (Aggregator)', isCompany: false },
  { type: 'himalayas', slug: '', name: 'Himalayas (Aggregator)', isCompany: false },
];

async function balancedLoad() {
  const workerDb = createWorkerDb(prisma);
  
  console.log('🚀 Starting balanced load of the freshest jobs...');
  console.log(`Target: ${LIMIT_PER_SOURCE} jobs per provider.\n`);

  for (const source of sources) {
    console.log(`--- Fetching from ${source.name} ---`);
    
    try {
      // 1. Resolve the explicit source adapter (no classes randomly instantiated)
      const adapter = resolveAdapter(source.type as any);
      
      // 2. Build the correct payload shape depending on if it's an ATS or aggregator
      const target = source.isCompany 
        ? { type: 'company' as const, slug: source.slug }
        : { type: 'bulk' as const, page: 1 };

      // 3. Formulate raw array fetch
      const rawJobs = await adapter.poll(target);
      
      // 4. Take the top fresh N jobs
      const limitedJobs = rawJobs.slice(0, LIMIT_PER_SOURCE);
      
      console.log(`Found ${rawJobs.length} total jobs. Saving the freshest ${limitedJobs.length}...`);

      // 5. Utilize Worker DB connection to safely validate HTML metrics and DB Constraints
      let successCount = 0;
      for (const job of limitedJobs) {
        try {
            await workerDb.upsertJob(job); 
            console.log(`  ✓ Loaded: ${job.title.substring(0, 60)}${job.title.length > 60 ? '...' : ''}`);
            successCount++;
        } catch (dbErr: any) {
            console.log(`  ⚠ Skipped: ${job.title} (${dbErr.message || 'Validation failed'})`);
        }
      }
      console.log(`✅ Completed ${source.name} with ${successCount} successful saves.\n`);
    } catch (error: any) {
      console.error(`  ✗ Error loading ${source.type}:`, error.message);
    }
  }
}

balancedLoad()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    console.log('✨ All done!');
  });
