import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

const GREENHOUSE_API = 'https://boards-api.greenhouse.io/v1/boards'
const LEVER_API = 'https://api.lever.co/v0/postings'
const ASHBY_API = 'https://api.ashbyhq.com/posting-api/job-board'

interface Candidate {
  name: string
  ats: string
  slug: string
}

async function verifySlug(candidate: Candidate): Promise<boolean> {
  let url = ''
  if (candidate.ats === 'greenhouse') {
    url = `${GREENHOUSE_API}/${candidate.slug}/jobs`
  } else if (candidate.ats === 'lever') {
    // Lever common pattern is jobs.lever.co/slug, but API is api.lever.co/v0/postings/slug
    url = `${LEVER_API}/${candidate.slug}?limit=1`
  } else if (candidate.ats === 'ashby') {
    url = `${ASHBY_API}/${candidate.slug}`
  } else if (candidate.ats === 'workday') {
    // Workday is harder to verify via simple GET, but we can check if the domain exists
    const [domain] = candidate.slug.split('::')
    url = `https://${domain}`
  } else {
    return false
  }

  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
    return res.status === 200 || res.status === 302
  } catch (e) {
    return false
  }
}

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'new-companies-candidates.json')
  const candidates: Candidate[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  console.log(`--- Starting Macro Ingestion of ${candidates.length} companies ---`)

  let added = 0
  let skipped = 0
  let invalid = 0

  for (const candidate of candidates) {
    // 1. Check if already exists
    const existing = await prisma.trackedCompany.findFirst({
      where: { slug: candidate.slug, ats: candidate.ats }
    })

    if (existing) {
      if (!existing.isActive) {
        await prisma.trackedCompany.update({
          where: { id: existing.id },
          data: { isActive: true }
        })
        console.log(`✅ Reactivated: ${candidate.name}`)
        added++
      } else {
        console.log(`⏩ Already active: ${candidate.name}`)
        skipped++
      }
      continue
    }

    // 2. Verify slug
    const isValid = await verifySlug(candidate)
    if (!isValid && candidate.ats !== 'workday') { // Special case: Workday verification is flaky, but we trust the seed
      console.log(`❌ Invalid Slug: ${candidate.name} (${candidate.slug} on ${candidate.ats})`)
      invalid++
      continue
    }

    // 3. Upsert
    await prisma.trackedCompany.upsert({
      where: { 
        slug_ats: { slug: candidate.slug, ats: candidate.ats } 
      },
      update: { isActive: true },
      create: {
        name: candidate.name,
        slug: candidate.slug,
        ats: candidate.ats,
        isActive: true,
        addedBy: 'macro_expansion'
      }
    })

    console.log(`✨ Added: ${candidate.name} (${candidate.ats})`)
    added++
    
    // Tiny delay to avoid spamming APIs
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n--- Ingestion Complete ---`)
  console.log(`Added/Reactivated: ${added}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Invalid: ${invalid}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
