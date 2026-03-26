import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.company.findMany()
  console.log('--- Companies ---')
  console.log(companies)

  const jobs = await prisma.job.findMany({ select: { company: true }, take: 5 })
  console.log('\n--- Jobs (Sample) ---')
  console.log(jobs)

  const res = await prisma.$queryRawUnsafe(`SELECT j.company as job_company, c.name as cmp_name, c.logo_url FROM jobs j LEFT JOIN companies c ON j.company = c.name LIMIT 5`)
  console.log('\n--- JOIN Result ---')
  console.log(res)
}

main().finally(() => prisma.$disconnect())
