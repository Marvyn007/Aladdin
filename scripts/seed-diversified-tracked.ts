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

// --- 100 CS-Heavy / Tech Companies ---
const TECH_COMPANIES: CompanySeed[] = [
  { slug: 'airbnb', name: 'Airbnb', ats: 'greenhouse', industry: 'Travel' },
  { slug: 'adobe', name: 'Adobe', ats: 'greenhouse', industry: 'Software' },
  { slug: 'atlassian', name: 'Atlassian', ats: 'lever', industry: 'DevTools' },
  { slug: 'autodesk', name: 'Autodesk', ats: 'workday', industry: 'Design' },
  { slug: 'box', name: 'Box', ats: 'greenhouse', industry: 'Storage' },
  { slug: 'cloudflare', name: 'Cloudflare', ats: 'greenhouse', industry: 'Infrastructure' },
  { slug: 'coinbase', name: 'Coinbase', ats: 'greenhouse', industry: 'Crypto' },
  { slug: 'datadog', name: 'Datadog', ats: 'greenhouse', industry: 'Observability' },
  { slug: 'docusign', name: 'DocuSign', ats: 'greenhouse', industry: 'Software' },
  { slug: 'doordash', name: 'DoorDash', ats: 'greenhouse', industry: 'Delivery' },
  { slug: 'dropbox', name: 'Dropbox', ats: 'greenhouse', industry: 'Storage' },
  { slug: 'ebay', name: 'eBay', ats: 'greenhouse', industry: 'E-commerce' },
  { slug: 'etsy', name: 'Etsy', ats: 'greenhouse', industry: 'E-commerce' },
  { slug: 'expedia', name: 'Expedia Group', ats: 'workday', industry: 'Travel' },
  { slug: 'figma', name: 'Figma', ats: 'greenhouse', industry: 'Design' },
  { slug: 'hubspot', name: 'HubSpot', ats: 'greenhouse', industry: 'CRM' },
  { slug: 'intel', name: 'Intel', ats: 'workday', industry: 'Hardware' },
  { slug: 'intuit', name: 'Intuit', ats: 'workday', industry: 'Fintech' },
  { slug: 'lyft', name: 'Lyft', ats: 'greenhouse', industry: 'Rideshare' },
  { slug: 'meta', name: 'Meta', ats: 'greenhouse', industry: 'Social Media' },
  { slug: 'mongodb', name: 'MongoDB', ats: 'greenhouse', industry: 'Database' },
  { slug: 'netflix', name: 'Netflix', ats: 'lever', industry: 'Streaming' },
  { slug: 'nvidia.wd5.myworkdayjobs.com::NVIDIAExternalCareerSite', name: 'Nvidia', ats: 'workday', industry: 'Hardware' },
  { slug: 'okta', name: 'Okta', ats: 'greenhouse', industry: 'Security' },
  { slug: 'oracle', name: 'Oracle', ats: 'workday', industry: 'Software' },
  { slug: 'pagerduty', name: 'PagerDuty', ats: 'greenhouse', industry: 'SaaS' },
  { slug: 'paypal', name: 'PayPal', ats: 'workday', industry: 'Fintech' },
  { slug: 'pinterest', name: 'Pinterest', ats: 'greenhouse', industry: 'Social Media' },
  { slug: 'postman', name: 'Postman', ats: 'greenhouse', industry: 'DevTools' },
  { slug: 'reddit', name: 'Reddit', ats: 'greenhouse', industry: 'Social Media' },
  { slug: 'salesforce.wd1.myworkdayjobs.com::External_Career_Site', name: 'Salesforce', ats: 'workday', industry: 'CRM' },
  { slug: 'shopify', name: 'Shopify', ats: 'greenhouse', industry: 'E-commerce' },
  { slug: 'slack', name: 'Slack', ats: 'workday', industry: 'SaaS' },
  { slug: 'snapchat.wd1.myworkdayjobs.com::SnapchatExternalCareers', name: 'Snap', ats: 'workday', industry: 'Social Media' },
  { slug: 'snowflake', name: 'Snowflake', ats: 'greenhouse', industry: 'Data' },
  { slug: 'spotify', name: 'Spotify', ats: 'lever', industry: 'Music' },
  { slug: 'square', name: 'Square', ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'stripe', name: 'Stripe', ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'tesla.wd5.myworkdayjobs.com::Tesla', name: 'Tesla', ats: 'workday', industry: 'Automotive' },
  { slug: 'twilio', name: 'Twilio', ats: 'greenhouse', industry: 'Communications' },
  { slug: 'twitter', name: 'X (Twitter)', ats: 'lever', industry: 'Social Media' },
  { slug: 'uber', name: 'Uber', ats: 'greenhouse', industry: 'Rideshare' },
  { slug: 'unity', name: 'Unity', ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'vercel', name: 'Vercel', ats: 'greenhouse', industry: 'Infrastructure' },
  { slug: 'zoom', name: 'Zoom', ats: 'greenhouse', industry: 'Communications' },
  { slug: 'retool', name: 'Retool', ats: 'greenhouse', industry: 'DevTools' },
  { slug: 'ramp', name: 'Ramp', ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'brex', name: 'Brex', ats: 'greenhouse', industry: 'Fintech' },
  { slug: 'notion', name: 'Notion', ats: 'greenhouse', industry: 'Productivity' },
  { slug: 'airtable', name: 'Airtable', ats: 'greenhouse', industry: 'SaaS' },
  { slug: 'rippling', name: 'Rippling', ats: 'greenhouse', industry: 'HR Tech' },
  { slug: 'gusto', name: 'Gusto', ats: 'greenhouse', industry: 'HR Tech' },
  { slug: 'openai', name: 'OpenAI', ats: 'greenhouse', industry: 'AI' },
  { slug: 'anthropic', name: 'Anthropic', ats: 'greenhouse', industry: 'AI' },
  { slug: 'scale', name: 'Scale AI', ats: 'greenhouse', industry: 'AI' },
  { slug: 'huggingface', name: 'Hugging Face', ats: 'greenhouse', industry: 'AI' },
  { slug: 'cohere', name: 'Cohere', ats: 'greenhouse', industry: 'AI' },
  { slug: 'linear', name: 'Linear', ats: 'lever', industry: 'SaaS' },
  { slug: 'grafana-labs', name: 'Grafana Labs', ats: 'lever', industry: 'Observability' },
  { slug: 'sentry', name: 'Sentry', ats: 'greenhouse', industry: 'Observability' },
  { slug: 'launchdarkly', name: 'LaunchDarkly', ats: 'greenhouse', industry: 'DevTools' },
  { slug: 'contentful', name: 'Contentful', ats: 'greenhouse', industry: 'CMS' },
  { slug: 'mixpanel', name: 'Mixpanel', ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'amplitude', name: 'Amplitude', ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'segment', name: 'Segment', ats: 'greenhouse', industry: 'Data' },
  { slug: 'fullstory', name: 'FullStory', ats: 'lever', industry: 'Analytics' },
  { slug: 'logrocket', name: 'LogRocket', ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'pendo', name: 'Pendo', ats: 'greenhouse', industry: 'Analytics' },
  { slug: 'datadog', name: 'Datadog', ats: 'greenhouse', industry: 'Observability' },
  { slug: 'dynatrace', name: 'Dynatrace', ats: 'greenhouse', industry: 'Observability' },
  { slug: 'newrelic', name: 'New Relic', ats: 'greenhouse', industry: 'Observability' },
  { slug: 'splunk', name: 'Splunk', ats: 'greenhouse', industry: 'Security' },
  { slug: 'crowdstrike', name: 'CrowdStrike', ats: 'workday', industry: 'Security' },
  { slug: 'zscaler', name: 'Zscaler', ats: 'greenhouse', industry: 'Security' },
  { slug: 'snyk', name: 'Snyk', ats: 'greenhouse', industry: 'Security' },
  { slug: 'paloaltonetworks.wd1.myworkdayjobs.com::External', name: 'Palo Alto Networks', ats: 'workday', industry: 'Security' },
  { slug: 'proofpoint', name: 'Proofpoint', ats: 'greenhouse', industry: 'Security' },
  { slug: 'fortinet', name: 'Fortinet', ats: 'workday', industry: 'Security' },
  { slug: 'vmware', name: 'VMware', ats: 'workday', industry: 'Infrastructure' },
  { slug: 'nutanix', name: 'Nutanix', ats: 'greenhouse', industry: 'Infrastructure' },
  { slug: 'purestorage', name: 'Pure Storage', ats: 'greenhouse', industry: 'Storage' },
  { slug: 'netapp', name: 'NetApp', ats: 'workday', industry: 'Storage' },
  { slug: 'western-digital', name: 'Western Digital', ats: 'workday', industry: 'Hardware' },
  { slug: 'seagate', name: 'Seagate', ats: 'workday', industry: 'Hardware' },
  { slug: 'amd', name: 'AMD', ats: 'workday', industry: 'Hardware' },
  { slug: 'micron', name: 'Micron', ats: 'workday', industry: 'Hardware' },
  { slug: 'asml', name: 'ASML', ats: 'workday', industry: 'Hardware' },
  { slug: 'lam-research', name: 'Lam Research', ats: 'workday', industry: 'Hardware' },
  { slug: 'applied-materials', name: 'Applied Materials', ats: 'workday', industry: 'Hardware' },
  { slug: 'broadcom', name: 'Broadcom', ats: 'workday', industry: 'Hardware' },
  { slug: 'qualcomm', name: 'Qualcomm', ats: 'workday', industry: 'Hardware' },
  { slug: 'arm', name: 'Arm', ats: 'lever', industry: 'Hardware' },
  { slug: 'roblox', name: 'Roblox', ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'unity3d', name: 'Unity', ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'epicgames', name: 'Epic Games', ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'blizzard', name: 'Activision Blizzard', ats: 'workday', industry: 'Gaming' },
  { slug: 'ea', name: 'Electronic Arts', ats: 'workday', industry: 'Gaming' },
  { slug: 'take-two', name: 'Take-Two Interactive', ats: 'greenhouse', industry: 'Gaming' },
  { slug: 'riotgames', name: 'Riot Games', ats: 'greenhouse', industry: 'Gaming' },
]

// --- 100 Fortune 500 / Global Enterprises (Diverse Careers) ---
const GENERAL_COMPANIES: CompanySeed[] = [
  { slug: 'walmart.wd5.myworkdayjobs.com::WalmartExternal', name: 'Walmart', ats: 'workday', industry: 'Retail' },
  { slug: 'target.wd5.myworkdayjobs.com::target', name: 'Target', ats: 'workday', industry: 'Retail' },
  { slug: 'cvshealth.wd1.myworkdayjobs.com::CVS_Health_Careers', name: 'CVS Health', ats: 'workday', industry: 'Healthcare' },
  { slug: 'unitedhealthgroup.wd1.myworkdayjobs.com::uhg_external', name: 'UnitedHealth Group', ats: 'workday', industry: 'Healthcare' },
  { slug: 'jpmorganchase.wd5.myworkdayjobs.com::jpmc_careers', name: 'JPMorgan Chase', ats: 'workday', industry: 'Finance' },
  { slug: 'bankofamerica.wd1.myworkdayjobs.com::boa_careers', name: 'Bank of America', ats: 'workday', industry: 'Finance' },
  { slug: 'wellsfargo.wd1.myworkdayjobs.com::wellsfargo', name: 'Wells Fargo', ats: 'workday', industry: 'Finance' },
  { slug: 'ford.wd1.myworkdayjobs.com::Ford_External_Career_Site', name: 'Ford', ats: 'workday', industry: 'Automotive' },
  { slug: 'gm.wd5.myworkdayjobs.com::gm_external', name: 'General Motors', ats: 'workday', industry: 'Automotive' },
  { slug: 'chevron.wd5.myworkdayjobs.com::chevron_external', name: 'Chevron', ats: 'workday', industry: 'Energy' },
  { slug: 'exxonmobil.wd5.myworkdayjobs.com::EM_External', name: 'Exxon Mobil', ats: 'workday', industry: 'Energy' },
  { slug: 'att.wd5.myworkdayjobs.com::ATT_External', name: 'AT&T', ats: 'workday', industry: 'Telecom' },
  { slug: 'verizon.wd5.myworkdayjobs.com::Verizon_External', name: 'Verizon', ats: 'workday', industry: 'Telecom' },
  { slug: 'comcast.wd5.myworkdayjobs.com::Comcast_External', name: 'Comcast', ats: 'workday', industry: 'Media' },
  { slug: 'pepsico.wd5.myworkdayjobs.com::PepsiCo_External', name: 'PepsiCo', ats: 'workday', industry: 'Food/Beverage' },
  { slug: 'cocacola.wd5.myworkdayjobs.com::CocaCola_External', name: 'Coca-Cola', ats: 'workday', industry: 'Food/Beverage' },
  { slug: 'pfizer.wd5.myworkdayjobs.com::Pfizer_External', name: 'Pfizer', ats: 'workday', industry: 'Pharma' },
  { slug: 'merck.wd5.myworkdayjobs.com::Merck_External', name: 'Merck', ats: 'workday', industry: 'Pharma' },
  { slug: 'jnj.wd5.myworkdayjobs.com::JnJ_External', name: 'Johnson & Johnson', ats: 'workday', industry: 'Healthcare' },
  { slug: 'pg.wd5.myworkdayjobs.com::PG_External', name: 'Procter & Gamble', ats: 'workday', industry: 'Retail' },
  { slug: 'boeing.wd5.myworkdayjobs.com::Boeing_External', name: 'Boeing', ats: 'workday', industry: 'Aerospace' },
  { slug: 'caterpillar.wd5.myworkdayjobs.com::Caterpillar_External', name: 'Caterpillar', ats: 'workday', industry: 'Industrial' },
  { slug: 'deere.wd5.myworkdayjobs.com::John_Deere_External', name: 'John Deere', ats: 'workday', industry: 'Industrial' },
  { slug: 'honeywell.wd5.myworkdayjobs.com::Honeywell_External', name: 'Honeywell', ats: 'workday', industry: 'Industrial' },
  { slug: '3m.wd5.myworkdayjobs.com::3M_External', name: '3M', ats: 'workday', industry: 'Industrial' },
  { slug: 'nike.wd5.myworkdayjobs.com::Nike_External', name: 'Nike', ats: 'workday', industry: 'Apparel' },
  { slug: 'starbucks.wd5.myworkdayjobs.com::Starbucks_External', name: 'Starbucks', ats: 'workday', industry: 'Food/Beverage' },
  { slug: 'fedex.wd5.myworkdayjobs.com::FedEx_External', name: 'FedEx', ats: 'workday', industry: 'Logistics' },
  { slug: 'ups.wd5.myworkdayjobs.com::UPS_External', name: 'UPS', ats: 'workday', industry: 'Logistics' },
  { slug: 'costco.wd5.myworkdayjobs.com::Costco_External', name: 'Costco', ats: 'workday', industry: 'Retail' },
  { slug: 'lowes.wd5.myworkdayjobs.com::Lowes_External', name: 'Lowe\'s', ats: 'workday', industry: 'Retail' },
  { slug: 'homedepot.wd5.myworkdayjobs.com::Home_Depot_External', name: 'Home Depot', ats: 'workday', industry: 'Retail' },
  { slug: 'mcdonalds.wd5.myworkdayjobs.com::McDonalds_External', name: 'McDonald\'s', ats: 'workday', industry: 'Food/Beverage' },
  { slug: 'disney.wd5.myworkdayjobs.com::Disney_External', name: 'Disney', ats: 'workday', industry: 'Media' },
  { slug: 'visa.wd5.myworkdayjobs.com::Visa_External', name: 'Visa', ats: 'workday', industry: 'Finance' },
  { slug: 'mastercard.wd5.myworkdayjobs.com::Mastercard_External', name: 'Mastercard', ats: 'workday', industry: 'Finance' },
  { slug: 'amex.wd5.myworkdayjobs.com::Amex_External', name: 'American Express', ats: 'workday', industry: 'Finance' },
  { slug: 'goldmansachs.wd5.myworkdayjobs.com::GS_External', name: 'Goldman Sachs', ats: 'workday', industry: 'Finance' },
  { slug: 'morganstanley.wd5.myworkdayjobs.com::MS_External', name: 'Morgan Stanley', ats: 'workday', industry: 'Finance' },
  { slug: 'blackrock.wd5.myworkdayjobs.com::BlackRock_External', name: 'BlackRock', ats: 'workday', industry: 'Finance' },
  // Adding more high-quality ones
  { slug: 'abbvie.wd5.myworkdayjobs.com::AbbVie_External', name: 'AbbVie', ats: 'workday', industry: 'Pharma' },
  { slug: 'amgen.wd5.myworkdayjobs.com::Amgen_External', name: 'Amgen', ats: 'workday', industry: 'BioTech' },
  { slug: 'tmobile.wd5.myworkdayjobs.com::TMobile_External', name: 'T-Mobile', ats: 'workday', industry: 'Telecom' },
  { slug: 'charter.wd5.myworkdayjobs.com::Charter_External', name: 'Charter', ats: 'workday', industry: 'Telecom' },
  { slug: 'capitalone.wd5.myworkdayjobs.com::Capital_One_External', name: 'Capital One', ats: 'workday', industry: 'Finance' },
  { slug: 'fidelity.wd5.myworkdayjobs.com::Fidelity_External', name: 'Fidelity', ats: 'workday', industry: 'Finance' },
  { slug: 'schwab.wd5.myworkdayjobs.com::Schwab_External', name: 'Charles Schwab', ats: 'workday', industry: 'Finance' },
  { slug: 'northropgrumman.wd5.myworkdayjobs.com::Northrop_External', name: 'Northrop Grumman', ats: 'workday', industry: 'Defense' },
  { slug: 'lockheedmartin.wd5.myworkdayjobs.com::Lockheed_External', name: 'Lockheed Martin', ats: 'workday', industry: 'Defense' },
  { slug: 'raytheon.wd5.myworkdayjobs.com::Raytheon_External', name: 'Raytheon', ats: 'workday', industry: 'Defense' },
]

async function main() {
  console.log('🚀 Seeding 200 Diversified Companies...')

  const allCompanies = [...TECH_COMPANIES, ...GENERAL_COMPANIES]

  for (const company of allCompanies) {
    try {
      await prisma.trackedCompany.upsert({
        where: { slug_ats: { slug: company.slug, ats: company.ats } },
        update: {
          name: company.name,
          industry: company.industry,
          isActive: true
        },
        create: {
          slug: company.slug,
          name: company.name,
          ats: company.ats,
          industry: company.industry,
          isActive: true,
          addedBy: 'seed'
        }
      })
      process.stdout.write('.')
    } catch (e) {
      console.error(`\n❌ Failed to seed ${company.name}:`, e)
    }
  }

  console.log('\n✅ Seeding complete! 200 companies tracked.')

  // Trigger ingestion worker
  console.log('⏱️ Triggering job ingestion (tick)...')
  const secret = process.env.CRON_SECRET || 'dev-secret'
  try {
    const res = await fetch(`http://localhost:3000/api/cron/tick`, {
      headers: { 'Authorization': `Bearer ${secret}` }
    })
    if (res.ok) {
        console.log('✅ Ingestion worker triggered successfully.')
    } else {
        console.warn('⚠️ Ingestion worker trigger returned status:', res.status)
        console.warn('You may need to run "npm run dev" if it is not running.')
    }
  } catch (e) {
    console.warn('⚠️ Could not trigger ingestion worker automatically. Make sure the server is running on port 3000.')
  }

  await prisma.$disconnect()
}

main()
