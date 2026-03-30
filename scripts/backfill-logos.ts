import { PrismaClient } from '@prisma/client'
import { getCompanyLogo } from '../src/lib/logo-dev'
import * as dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function backfill() {
  console.log('--- Starting Logo.dev Backfill ---')
  
  // 1. Get all companies that don't have a logo.dev URL or are missing a logo
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { logoUrl: null },
        { logoUrl: { not: { contains: 'logo.dev' } } },
        { logoFetched: false }
      ]
    }
  })

  console.log(`Found ${companies.length} companies to update.`)

  for (const company of companies) {
    process.stdout.write(`Processing ${company.name}... `)
    
    try {
      const { domain, logoUrl } = await getCompanyLogo(company.name)
      
      if (logoUrl) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            domain: domain || company.domain,
            logoUrl: logoUrl,
            logoFetched: true
          }
        })

        // Also update TrackedCompany if it matches by name
        await prisma.trackedCompany.updateMany({
          where: { name: company.name },
          data: { logoUrl: logoUrl }
        })

        process.stdout.write('✅ Updated\n')
      } else {
        process.stdout.write('❌ Not found\n')
      }
    } catch (error) {
      process.stdout.write('⚠️ Error\n')
      console.error(`  Error for ${company.name}:`, error)
    }

    // Small delay to avoid hitting search API limits too hard
    await new Promise(r => setTimeout(r, 200))
  }

  // 2. Also check TrackedCompanies directly for any missed ones (synced by name above, but just in case)
  const tracked = await prisma.trackedCompany.findMany({
    where: {
      OR: [
        { logoUrl: null },
        { logoUrl: { not: { contains: 'logo.dev' } } }
      ]
    }
  })

  if (tracked.length > 0) {
    console.log(`\nChecking ${tracked.length} tracked companies for missing logos...`)
    for (const tc of tracked) {
      process.stdout.write(`Processing ${tc.name || tc.slug}... `)
      const { logoUrl } = await getCompanyLogo(tc.name || tc.slug)
      if (logoUrl) {
        await prisma.trackedCompany.update({
          where: { id: tc.id },
          data: { logoUrl }
        })
        process.stdout.write('✅ Updated\n')
      } else {
        process.stdout.write('❌ Not found\n')
      }
      await new Promise(r => setTimeout(r, 200))
    }
  }

  console.log('--- Backfill Complete ---')
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
