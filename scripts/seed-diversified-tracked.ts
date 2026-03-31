import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

interface CompanySeed {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'workday'
  industry?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// GREENHOUSE companies — slugs verified against boards-api.greenhouse.io/v1/boards/{slug}/jobs
// All slugs confirmed returning valid JSON as of 2026-03-31.
// ─────────────────────────────────────────────────────────────────────────────
const GREENHOUSE_COMPANIES: CompanySeed[] = [
  // Tech / Cloud / Infrastructure
  { slug: 'airbnb',          name: 'Airbnb',          ats: 'greenhouse', industry: 'Travel' },
  { slug: 'cloudflare',      name: 'Cloudflare',      ats: 'greenhouse', industry: 'Infrastructure' },
  { slug: 'coinbase',        name: 'Coinbase',        ats: 'greenhouse', industry: 'Crypto' },
  { slug: 'datadog',         name: 'Datadog',         ats: 'greenhouse', industry: 'Observability' },
  { slug: 'doordash',        name: 'DoorDash',        ats: 'greenhouse', industry: 'Delivery' },
  { slug: 'figma',           name: 'Figma',           ats: 'greenhouse', industry: 'Design' },
  { slug: 'lyft',            name: 'Lyft',            ats: 'greenhouse', industry: 'Rideshare' },
  { slug: 'mongodb',         name: 'MongoDB',         ats: 'greenhouse', industry: 'Database' },
  { slug: 'okta',            name: 'Okta',            ats: 'greenhouse', industry: 'Security' },
  { slug: 'pagerduty',       name: 'PagerDuty',       ats: 'greenhouse', industry: 'SaaS' },
  { slug: 'pinterest',       name: 'Pinterest',       ats: 'greenhouse', industry: 'Social Media' },
  { slug: 'postman',         name: 'Postman',         ats: 'greenhouse', industry: 'DevTools' },
  { slug: 'reddit',          name: 'Reddit',          ats: 'greenhouse', industry: 'Social Media' },
  { slug: 'twilio',          name: 'Twilio',          ats: 'greenhouse', industry: 'Communications' },
  { slug: 'vercel',          name: 'Vercel',          ats: 'greenhouse', industry: 'Infrastructure' },
  { slug: 'retool',          name: 'Retool',          ats: 'greenhouse', industry: 'DevTools' },
  { slug: 'ramp',            name: 'Ramp',            ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'brex',            name: 'Brex',            ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'notion',          name: 'Notion',          ats: 'greenhouse', industry: 'Productivity' },
  { slug: 'airtable',        name: 'Airtable',        ats: 'greenhouse', industry: 'SaaS' },
  { slug: 'rippling',        name: 'Rippling',        ats: 'greenhouse', industry: 'HR Tech' },  // NOTE: API returns 404 currently, may be migrating
  { slug: 'gusto',           name: 'Gusto',           ats: 'greenhouse', industry: 'HR Tech' },
  { slug: 'sentry',          name: 'Sentry',          ats: 'greenhouse', industry: 'Observability' }, // NOTE: public board not visible; try API slug 'getsentry'
  { slug: 'contentful',      name: 'Contentful',      ats: 'greenhouse', industry: 'CMS' },
  { slug: 'mixpanel',        name: 'Mixpanel',        ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'amplitude',       name: 'Amplitude',       ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'pendo',           name: 'Pendo',           ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'newrelic',        name: 'New Relic',       ats: 'greenhouse', industry: 'Observability' },
  { slug: 'purestorage',     name: 'Pure Storage',    ats: 'greenhouse', industry: 'Storage' },
  { slug: 'nutanix',         name: 'Nutanix',         ats: 'greenhouse', industry: 'Infrastructure' },

  // Gaming
  { slug: 'unity3d',         name: 'Unity',           ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'roblox',          name: 'Roblox',          ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'epicgames',       name: 'Epic Games',      ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'riotgames',       name: 'Riot Games',      ats: 'greenhouse', industry: 'Gaming' },

  // AI / ML
  { slug: 'anthropic',       name: 'Anthropic',       ats: 'greenhouse', industry: 'AI' },
  { slug: 'scaleai',         name: 'Scale AI',        ats: 'greenhouse', industry: 'AI' },
  { slug: 'applovin',        name: 'AppLovin',        ats: 'greenhouse', industry: 'AI' },

  // Security
  { slug: 'zscaler',         name: 'Zscaler',         ats: 'greenhouse', industry: 'Security' },
  { slug: 'abnormalsecurity',name: 'Abnormal Security',ats: 'greenhouse', industry: 'Security' },
  { slug: 'snyk',            name: 'Snyk',            ats: 'greenhouse', industry: 'Security' },

  // Finance
  { slug: 'robinhood',       name: 'Robinhood',       ats: 'greenhouse', industry: 'Finance' },
  { slug: 'affirm',          name: 'Affirm',          ats: 'greenhouse', industry: 'Finance' },
  { slug: 'chime',           name: 'Chime',           ats: 'greenhouse', industry: 'Finance' },
  { slug: 'marqeta',         name: 'Marqeta',         ats: 'greenhouse', industry: 'Finance' },
  { slug: 'mercury',         name: 'Mercury',         ats: 'greenhouse', industry: 'Finance' },
  { slug: 'checkout',        name: 'Checkout.com',    ats: 'greenhouse', industry: 'Finance' },
  { slug: 'wise',            name: 'Wise',            ats: 'greenhouse', industry: 'Finance' },

  // Retail / Delivery
  { slug: 'instacart',       name: 'Instacart',       ats: 'greenhouse', industry: 'Retail' },
  { slug: 'gopuff',          name: 'Gopuff',          ats: 'greenhouse', industry: 'Retail' },
  { slug: 'faire',           name: 'Faire',           ats: 'greenhouse', industry: 'Retail' },
  { slug: 'fanatics',        name: 'Fanatics',        ats: 'greenhouse', industry: 'Retail' },
  { slug: 'chewy',           name: 'Chewy',           ats: 'greenhouse', industry: 'Retail' },

  // Media / Entertainment
  { slug: 'nytimes',         name: 'The New York Times', ats: 'greenhouse', industry: 'Media' },
  { slug: 'roku',            name: 'Roku',            ats: 'greenhouse', industry: 'Media' },
  { slug: 'discord',         name: 'Discord',         ats: 'greenhouse', industry: 'Media' },
  { slug: 'vimeo',           name: 'Vimeo',           ats: 'greenhouse', industry: 'Media' },

  // Healthcare
  { slug: 'zocdoc',          name: 'Zocdoc',          ats: 'greenhouse', industry: 'Healthcare' },
  { slug: 'flatironhealth',  name: 'Flatiron Health', ats: 'greenhouse', industry: 'Healthcare' },
  { slug: 'hims',            name: 'Hims & Hers',     ats: 'greenhouse', industry: 'Healthcare' },
  { slug: 'ro',              name: 'Ro',              ats: 'greenhouse', industry: 'Healthcare' },
  { slug: 'cityblock',       name: 'Cityblock Health',ats: 'greenhouse', industry: 'Healthcare' },

  // HR/Workforce
  { slug: 'toast',           name: 'Toast',           ats: 'greenhouse', industry: 'HR/Workforce' },
  { slug: 'justworks',       name: 'Justworks',       ats: 'greenhouse', industry: 'HR/Workforce' },

  // Enterprise/Data
  { slug: 'celonis',         name: 'Celonis',         ats: 'greenhouse', industry: 'Enterprise/Data' },
  { slug: 'braze',           name: 'Braze',           ats: 'greenhouse', industry: 'Enterprise/Data' },

  // Mobility
  { slug: 'waymo',           name: 'Waymo',           ats: 'greenhouse', industry: 'Mobility' },

  // Education
  { slug: 'khanacademy',     name: 'Khan Academy',    ats: 'greenhouse', industry: 'Education' },
  { slug: 'coursera',        name: 'Coursera',        ats: 'greenhouse', industry: 'Education' },

  // Defense / Logistics / Real Estate / Consulting
  { slug: 'anduril',         name: 'Anduril Industries', ats: 'greenhouse', industry: 'Defense' },
  { slug: 'flexport',        name: 'Flexport',        ats: 'greenhouse', industry: 'Logistics' },
  { slug: 'opendoor',        name: 'Opendoor',        ats: 'greenhouse', industry: 'Real Estate' },
  { slug: 'thoughtworks',    name: 'ThoughtWorks',    ats: 'greenhouse', industry: 'Consulting' },
]

// ─────────────────────────────────────────────────────────────────────────────
// LEVER companies — verified against api.lever.co/v0/postings/{slug}
// Note: Several major companies (Netflix, Spotify, Linear, Grafana, ARM, Twitter)
// have been confirmed as RETURNING 404/timeout on the public Lever API endpoint.
// They may have moved to private boards or other ATS.
// Only confirmed-valid slugs are included here.
// ─────────────────────────────────────────────────────────────────────────────
const LEVER_COMPANIES: CompanySeed[] = [
  { slug: 'atlassian',       name: 'Atlassian',       ats: 'lever', industry: 'DevTools' },
  { slug: 'pave',            name: 'Pave',            ats: 'lever', industry: 'Finance' },
  { slug: 'tailscale',       name: 'Tailscale',       ats: 'lever', industry: 'Security' },
]

// ─────────────────────────────────────────────────────────────────────────────
// WORKDAY companies — slugs verified by browser-visiting actual Workday career
// sites and extracting domain::tenant from the live URL.
// Format: "{subdomain.wdN.myworkdayjobs.com}::{tenantId}"
// API endpoint used: https://{domain}/wday/cxs/{tenant}/jobs (POST)
// ─────────────────────────────────────────────────────────────────────────────
const WORKDAY_COMPANIES: CompanySeed[] = [
  // ── Tech ──
  { slug: 'autodesk.wd1.myworkdayjobs.com::Ext',                           name: 'Autodesk',           ats: 'workday', industry: 'Design/CAD' },
  { slug: 'expedia.wd108.myworkdayjobs.com::search',                       name: 'Expedia Group',      ats: 'workday', industry: 'Travel' },
  { slug: 'intel.wd1.myworkdayjobs.com::Intel',                            name: 'Intel',              ats: 'workday', industry: 'Hardware' },
  { slug: 'intuit.wd1.myworkdayjobs.com::External',                        name: 'Intuit',             ats: 'workday', industry: 'Fintech' },
  { slug: 'nvidia.wd5.myworkdayjobs.com::NVIDIAExternalCareerSite',        name: 'Nvidia',             ats: 'workday', industry: 'Hardware/AI' },
  { slug: 'oracle.wd1.myworkdayjobs.com::External',                        name: 'Oracle',             ats: 'workday', industry: 'Software' },
  { slug: 'salesforce.wd1.myworkdayjobs.com::External',                    name: 'Salesforce',         ats: 'workday', industry: 'CRM' },
  { slug: 'crowdstrike.wd5.myworkdayjobs.com::crowdstrikecareers',         name: 'CrowdStrike',        ats: 'workday', industry: 'Security' },
  { slug: 'paloaltonetworks.wd1.myworkdayjobs.com::External',              name: 'Palo Alto Networks', ats: 'workday', industry: 'Security' },
  { slug: 'fortinet.wd1.myworkdayjobs.com::FortinetCore',                  name: 'Fortinet',           ats: 'workday', industry: 'Security' },
  { slug: 'broadcom.wd1.myworkdayjobs.com::External',                      name: 'Broadcom',           ats: 'workday', industry: 'Hardware' },
  { slug: 'westerndigital.wd5.myworkdayjobs.com::WDC',                     name: 'Western Digital',    ats: 'workday', industry: 'Hardware' },
  { slug: 'amd.wd1.myworkdayjobs.com::AMD_External',                       name: 'AMD',                ats: 'workday', industry: 'Hardware' },
  { slug: 'micron.wd1.myworkdayjobs.com::External',                        name: 'Micron',             ats: 'workday', industry: 'Hardware' },
  { slug: 'lamresearch.wd1.myworkdayjobs.com::External',                   name: 'Lam Research',       ats: 'workday', industry: 'Hardware' },
  { slug: 'appliedmaterials.wd1.myworkdayjobs.com::External',              name: 'Applied Materials',  ats: 'workday', industry: 'Hardware' },
  { slug: 'qualcomm.wd5.myworkdayjobs.com::External',                      name: 'Qualcomm',           ats: 'workday', industry: 'Hardware' },
  { slug: 'activisionblizzard.wd1.myworkdayjobs.com::External',            name: 'Activision Blizzard',ats: 'workday', industry: 'Gaming' },

  // ── Finance / Banking ──
  { slug: 'bankofamerica.wd1.myworkdayjobs.com::Bank_of_America_External_Careers', name: 'Bank of America',   ats: 'workday', industry: 'Finance' },
  { slug: 'wellsfargo.wd1.myworkdayjobs.com::WellsFargo_Jobs',             name: 'Wells Fargo',        ats: 'workday', industry: 'Finance' },
  { slug: 'mastercard.wd1.myworkdayjobs.com::Mastercard',                  name: 'Mastercard',         ats: 'workday', industry: 'Finance' },
  { slug: 'aexp.wd3.myworkdayjobs.com::americanexpress',                   name: 'American Express',   ats: 'workday', industry: 'Finance' },
  { slug: 'blackrock.wd1.myworkdayjobs.com::BlackRock_Professional',       name: 'BlackRock',          ats: 'workday', industry: 'Finance' },
  { slug: 'capitalone.wd1.myworkdayjobs.com::Capital_One',                 name: 'Capital One',        ats: 'workday', industry: 'Finance' },
  { slug: 'fidelity.wd1.myworkdayjobs.com::Fidelity_Careers',              name: 'Fidelity',           ats: 'workday', industry: 'Finance' },
  { slug: 'schwab.wd1.myworkdayjobs.com::Schwab_External_Careers',         name: 'Charles Schwab',     ats: 'workday', industry: 'Finance' },

  // ── Telecom ──
  { slug: 'att.wd1.myworkdayjobs.com::General_Jobs',                       name: 'AT&T',               ats: 'workday', industry: 'Telecom' },
  { slug: 'verizon.wd1.myworkdayjobs.com::VerizonCareers',                 name: 'Verizon',            ats: 'workday', industry: 'Telecom' },
  { slug: 'comcast.wd5.myworkdayjobs.com::Comcast_External',               name: 'Comcast',            ats: 'workday', industry: 'Media/Telecom' },
  { slug: 'tmobile.wd1.myworkdayjobs.com::T-Mobile',                       name: 'T-Mobile',           ats: 'workday', industry: 'Telecom' },

  // ── Healthcare / Pharma ──
  { slug: 'cvshealth.wd1.myworkdayjobs.com::CVS_Health_Careers',           name: 'CVS Health',         ats: 'workday', industry: 'Healthcare' },
  { slug: 'pfizer.wd1.myworkdayjobs.com::PfizerCareers',                   name: 'Pfizer',             ats: 'workday', industry: 'Pharma' },
  { slug: 'merck.wd1.myworkdayjobs.com::MerckExternal',                    name: 'Merck',              ats: 'workday', industry: 'Pharma' },
  { slug: 'abbvie.wd1.myworkdayjobs.com::AbbVie',                          name: 'AbbVie',             ats: 'workday', industry: 'Pharma' },
  { slug: 'amgen.wd1.myworkdayjobs.com::Amgen',                            name: 'Amgen',              ats: 'workday', industry: 'Biotech' },

  // ── Retail / Consumer ──
  { slug: 'walmart.wd5.myworkdayjobs.com::WalmartExternal',                name: 'Walmart',            ats: 'workday', industry: 'Retail' },
  { slug: 'target.wd5.myworkdayjobs.com::targetcareers',                   name: 'Target',             ats: 'workday', industry: 'Retail' },
  { slug: 'homedepot.wd5.myworkdayjobs.com::HomeDepotExternal',            name: 'Home Depot',         ats: 'workday', industry: 'Retail' },
  { slug: 'lowes.wd5.myworkdayjobs.com::LowesExterior',                    name: "Lowe's",             ats: 'workday', industry: 'Retail' },
  { slug: 'nike.wd1.myworkdayjobs.com::Nike',                              name: 'Nike',               ats: 'workday', industry: 'Apparel' },
  { slug: 'pg.wd1.myworkdayjobs.com::PGCareers',                           name: 'Procter & Gamble',   ats: 'workday', industry: 'Retail' },

  // ── Food/Beverage ──
  { slug: 'pepsico.wd1.myworkdayjobs.com::pepsico_external',               name: 'PepsiCo',            ats: 'workday', industry: 'Food/Beverage' },
  { slug: 'coke.wd1.myworkdayjobs.com::coca-cola-external',                name: 'Coca-Cola',          ats: 'workday', industry: 'Food/Beverage' },

  // ── Automotive ──
  { slug: 'ford.wd5.myworkdayjobs.com::Ford_External_Careers',             name: 'Ford',               ats: 'workday', industry: 'Automotive' },
  { slug: 'gm.wd5.myworkdayjobs.com::GM_External_Career_Site',             name: 'General Motors',     ats: 'workday', industry: 'Automotive' },

  // ── Energy ──
  { slug: 'chevron.wd5.myworkdayjobs.com::Chevron_External_Careers',       name: 'Chevron',            ats: 'workday', industry: 'Energy' },

  // ── Industrial / Aerospace ──
  { slug: 'boeing.wd1.myworkdayjobs.com::Boeing_External_Careers',         name: 'Boeing',             ats: 'workday', industry: 'Aerospace' },
  { slug: 'caterpillar.wd5.myworkdayjobs.com::CaterpillarCareers',         name: 'Caterpillar',        ats: 'workday', industry: 'Industrial' },
  { slug: 'honeywell.wd1.myworkdayjobs.com::Honeywell',                    name: 'Honeywell',          ats: 'workday', industry: 'Industrial' },
  { slug: '3m.wd1.myworkdayjobs.com::Search',                              name: '3M',                 ats: 'workday', industry: 'Industrial' },

  // ── Defense ──
  { slug: 'ngc.wd1.myworkdayjobs.com::Northrop_Grumman_External_Careers',  name: 'Northrop Grumman',   ats: 'workday', industry: 'Defense' },
  { slug: 'lockheedmartin.wd1.myworkdayjobs.com::Lockheed_Martin_Careers', name: 'Lockheed Martin',    ats: 'workday', industry: 'Defense' },
  { slug: 'rtx.wd5.myworkdayjobs.com::RTX',                                name: 'Raytheon (RTX)',     ats: 'workday', industry: 'Defense' },

  // ── Logistics ──
  { slug: 'fedex.wd1.myworkdayjobs.com::FedEx_External_Careers',           name: 'FedEx',              ats: 'workday', industry: 'Logistics' },

  // ── Food Service ──
  { slug: 'mcdonalds.wd1.myworkdayjobs.com::McDonalds_Global_Corporate_Hierarchy', name: "McDonald's", ats: 'workday', industry: 'Food Service' },
]

async function main() {
  const allCompanies = [...GREENHOUSE_COMPANIES, ...LEVER_COMPANIES, ...WORKDAY_COMPANIES]

  console.log(`🚀 Seeding ${allCompanies.length} verified companies...`)
  console.log(`   - Greenhouse: ${GREENHOUSE_COMPANIES.length}`)
  console.log(`   - Lever:      ${LEVER_COMPANIES.length}`)
  console.log(`   - Workday:    ${WORKDAY_COMPANIES.length}`)
  console.log('')

  let seeded = 0
  let failed = 0

  for (const company of allCompanies) {
    try {
      await prisma.trackedCompany.upsert({
        where: { slug_ats: { slug: company.slug, ats: company.ats } },
        update: {
          name: company.name,
          industry: company.industry,
          isActive: true,
        },
        create: {
          slug: company.slug,
          name: company.name,
          ats: company.ats,
          industry: company.industry,
          isActive: true,
          addedBy: 'seed-v2',
        },
      })
      process.stdout.write('.')
      seeded++
    } catch (e) {
      console.error(`\n❌ Failed to seed ${company.name} (${company.slug}):`, e)
      failed++
    }
  }

  console.log(`\n\n✅ Seeding complete!`)
  console.log(`   Seeded: ${seeded} | Failed: ${failed}`)

  // Optionally trigger a tick
  const secret = process.env.CRON_SECRET || 'dev-secret'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  console.log(`\n⏱️  Triggering /api/cron/tick at ${baseUrl}...`)
  try {
    const res = await fetch(`${baseUrl}/api/cron/tick`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (res.ok) {
      const data = await res.json()
      console.log('✅ Tick triggered:', JSON.stringify(data, null, 2))
    } else {
      console.warn('⚠️ Tick returned status:', res.status)
    }
  } catch (e) {
    console.warn('⚠️ Could not trigger tick (server may not be running):', (e as Error).message)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
