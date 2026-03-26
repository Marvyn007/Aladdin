import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.company.findMany()
  for (const c of companies) {
    if (c.domain && !c.logoUrl) {
      const finalLogoUrl = `https://logo.clearbit.com/${c.domain}`
      await prisma.company.update({
        where: { id: c.id },
        data: { logoUrl: finalLogoUrl }
      })
      console.log(`Updated ${c.name} with logo ${finalLogoUrl}`)
    } else if (!c.domain && !c.logoUrl) {
      await prisma.company.update({
         where: { id: c.id },
         data: { logoFetched: false }
      })
      console.log(`Reset ${c.name} to logoFetched: false so it gets retried`)
    }
  }
}

main().finally(() => prisma.$disconnect())
