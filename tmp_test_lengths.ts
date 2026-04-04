import { GreenhouseAdapter } from './src/lib/job-sources/adapters/greenhouse';
import { LeverAdapter } from './src/lib/job-sources/adapters/lever';

async function testGreenhouse() {
  console.log("--- Testing Greenhouse (Stripe) ---");
  const adapter = new GreenhouseAdapter();
  try {
    const jobs = await adapter.poll({ type: 'company', slug: 'stripe' });
    console.log(`Fetched ${jobs.length} jobs from Stripe`);
    jobs.slice(0, 3).forEach((job, i) => {
      console.log(`Job ${i+1}: "${job.title}" - Description Length: ${job.jobDescriptionPlain?.length || 0}`);
      if (job.jobDescriptionPlain && job.jobDescriptionPlain.length < 3000) {
        console.log(`   ⚠️ WOULD BE REJECTED (length < 3000)`);
      }
    });
  } catch (e: any) {
    console.error("Greenhouse failed:", e.message);
  }
}

async function testLever() {
  console.log("\n--- Testing Lever (Spotify) ---");
  const adapter = new LeverAdapter();
  try {
    const jobs = await adapter.poll({ type: 'company', slug: 'spotify' });
    console.log(`Fetched ${jobs.length} jobs from Spotify`);
    jobs.slice(0, 1).forEach((job, i) => {
      console.log(`Job ${i+1}: "${job.title}" - Description Length: ${job.jobDescriptionPlain?.length || 0}`);
      console.log(`Snippet: ${job.jobDescriptionPlain?.substring(0, 500)}...`);
      console.log(`End Snippet: ...${job.jobDescriptionPlain?.substring(job.jobDescriptionPlain.length - 300)}`);
    });
  } catch (e: any) {
    console.error("Lever failed:", e.message);
  }
}

async function main() {
  await testGreenhouse();
  await testLever();
}

main().catch(console.error);
