/**
 * Creates 4 test users in Clerk + seeds their subscription/usage in DB.
 * Run: npx tsx scripts/seed-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLERK_SECRET = process.env.CLERK_SECRET_KEY!;
const BASE_URL = 'https://api.clerk.com/v1';

const TEST_USERS = [
  {
    label: 'Copilot (active)',
    email: 'test.copilot@aladdin.dev',
    password: 'TestCopilot123!',
    planType: 'COPILOT',
    usage: { resumesGenerated: 2, coverLettersGenerated: 5, emailsRetrieved: 3, linkedinRetrieved: 10 },
  },
  {
    label: 'Copilot (limit reached)',
    email: 'test.copilot.maxed@aladdin.dev',
    password: 'TestCopilotMax123!',
    planType: 'COPILOT',
    usage: { resumesGenerated: 15, coverLettersGenerated: 30, emailsRetrieved: 30, linkedinRetrieved: 60 },
  },
  {
    label: 'Captain (active)',
    email: 'test.captain@aladdin.dev',
    password: 'TestCaptain123!',
    planType: 'CAPTAIN',
    usage: { resumesGenerated: 5, coverLettersGenerated: 10, emailsRetrieved: 8, linkedinRetrieved: 20 },
  },
  {
    label: 'Captain (limit reached)',
    email: 'test.captain.maxed@aladdin.dev',
    password: 'TestCaptainMax123!',
    planType: 'CAPTAIN',
    usage: { resumesGenerated: 60, coverLettersGenerated: 0, emailsRetrieved: 150, linkedinRetrieved: 0 },
  },
];

async function clerkRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as any;
  if (!res.ok) throw new Error(`Clerk ${method} ${path} failed: ${JSON.stringify(json.errors ?? json)}`);
  return json;
}

async function getOrCreateClerkUser(email: string, password: string): Promise<string> {
  // Check if user already exists
  const search = await clerkRequest('GET', `/users?email_address=${encodeURIComponent(email)}`);
  if (Array.isArray(search) && search.length > 0) {
    console.log(`  → Found existing Clerk user: ${search[0].id}`);
    // Update password in case it changed
    await clerkRequest('PATCH', `/users/${search[0].id}`, { password });
    return search[0].id as string;
  }

  const user = await clerkRequest('POST', '/users', {
    email_address: [email],
    password,
    skip_password_checks: true,
    skip_password_requirement: false,
  });
  console.log(`  → Created Clerk user: ${user.id}`);
  return user.id as string;
}

async function ensureDbUser(userId: string, email: string) {
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: { email },
  });
}

async function seedSubscription(userId: string, planType: string) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planType,
      status: 'active',
      currentPeriodEnd: periodEnd,
    },
    update: {
      planType,
      status: 'active',
      currentPeriodEnd: periodEnd,
    },
  });
}

async function seedUsage(userId: string, usage: (typeof TEST_USERS)[0]['usage']) {
  await prisma.userUsage.upsert({
    where: { userId },
    create: {
      userId,
      resumesGenerated: usage.resumesGenerated,
      coverLettersGenerated: usage.coverLettersGenerated,
      emailsRetrieved: usage.emailsRetrieved,
      linkedinRetrieved: usage.linkedinRetrieved,
    },
    update: {
      resumesGenerated: usage.resumesGenerated,
      coverLettersGenerated: usage.coverLettersGenerated,
      emailsRetrieved: usage.emailsRetrieved,
      linkedinRetrieved: usage.linkedinRetrieved,
    },
  });
}

async function main() {
  if (!CLERK_SECRET) throw new Error('CLERK_SECRET_KEY not set in environment');

  console.log('Seeding test users...\n');

  const results: { label: string; email: string; password: string; clerkId: string }[] = [];

  for (const user of TEST_USERS) {
    console.log(`[${user.label}]`);
    try {
      const clerkId = await getOrCreateClerkUser(user.email, user.password);
      await ensureDbUser(clerkId, user.email);
      await seedSubscription(clerkId, user.planType);
      await seedUsage(clerkId, user.usage);
      results.push({ label: user.label, email: user.email, password: user.password, clerkId });
      console.log(`  ✓ Done\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('TEST USERS SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`\n${r.label}`);
    console.log(`  Email:    ${r.email}`);
    console.log(`  Password: ${r.password}`);
    console.log(`  ClerkID:  ${r.clerkId}`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
