import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Deleting all jobs from the database...')
  const result = await prisma.job.deleteMany({})
  console.log(`Successfully deleted ${result.count} jobs. Database is now at 0 jobs.`)
}

main()
  .catch((e) => {
    console.error('Error deleting jobs:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
