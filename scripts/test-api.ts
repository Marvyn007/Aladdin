import fetch from 'node-fetch'; // Polyfill if needed

async function testGreenhouse() {
  const url = 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true';
  console.log(`Fetching from ${url}`);
  const res = await fetch(url);
  const data = await res.json() as any;
  if (data.jobs && data.jobs.length > 0) {
    const job = data.jobs[0];
    console.log('Greenhouse job has content?', !!job.content, 'length:', job.content?.length);
  } else {
    console.log('No jobs found or error:', data);
  }
}

async function testLever() {
  const url = 'https://api.lever.co/v0/postings/netflix?mode=json';
  console.log(`Fetching from ${url}`);
  const res = await fetch(url);
  const data = await res.json() as any;
  if (data && data.length > 0) {
    const job = data[0];
    console.log('Lever job has description?', !!job.descriptionPlain, 'length:', job.descriptionPlain?.length);
  } else {
    console.log('No jobs found or error:', data);
  }
}

async function main() {
  await testGreenhouse();
  await testLever();
}

main().catch(console.error);
