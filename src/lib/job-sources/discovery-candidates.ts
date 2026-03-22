import type { DiscoveryTier } from './types'

export interface DiscoveryCandidate {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever'
  tier: DiscoveryTier
  industry?: string
  country?: string
}

// ── Tier 1: High-priority (YC top, well-known tech) ──
const TIER_1: DiscoveryCandidate[] = [
  { slug: 'stripe', name: 'Stripe', ats: 'greenhouse', tier: 1, industry: 'Fintech' },
  { slug: 'retool', name: 'Retool', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'figma', name: 'Figma', ats: 'greenhouse', tier: 1, industry: 'Design' },
  { slug: 'brex', name: 'Brex', ats: 'greenhouse', tier: 1, industry: 'Fintech' },
  { slug: 'ramp', name: 'Ramp', ats: 'greenhouse', tier: 1, industry: 'Fintech' },
  { slug: 'scale', name: 'Scale AI', ats: 'greenhouse', tier: 1, industry: 'AI' },
  { slug: 'vercel', name: 'Vercel', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'notion', name: 'Notion', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'airtable', name: 'Airtable', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'plaid', name: 'Plaid', ats: 'greenhouse', tier: 1, industry: 'Fintech' },
  { slug: 'rippling', name: 'Rippling', ats: 'greenhouse', tier: 1, industry: 'HR Tech' },
  { slug: 'gusto', name: 'Gusto', ats: 'greenhouse', tier: 1, industry: 'HR Tech' },
  { slug: 'openai', name: 'OpenAI', ats: 'greenhouse', tier: 1, industry: 'AI' },
  { slug: 'anthropic', name: 'Anthropic', ats: 'greenhouse', tier: 1, industry: 'AI' },
  { slug: 'coinbase', name: 'Coinbase', ats: 'greenhouse', tier: 1, industry: 'Crypto' },
  { slug: 'datadog', name: 'Datadog', ats: 'greenhouse', tier: 1, industry: 'Observability' },
  { slug: 'confluent', name: 'Confluent', ats: 'greenhouse', tier: 1, industry: 'Data' },
  { slug: 'cloudflare', name: 'Cloudflare', ats: 'greenhouse', tier: 1, industry: 'Infrastructure' },
  { slug: 'hashicorp', name: 'HashiCorp', ats: 'greenhouse', tier: 1, industry: 'Infrastructure' },
  { slug: 'cockroachlabs', name: 'Cockroach Labs', ats: 'greenhouse', tier: 1, industry: 'Data' },
  { slug: 'netlify', name: 'Netlify', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'supabase', name: 'Supabase', ats: 'greenhouse', tier: 1, industry: 'Tech' },
  { slug: 'grafana-labs', name: 'Grafana Labs', ats: 'lever', tier: 1, industry: 'Observability' },
  { slug: 'anduril', name: 'Anduril', ats: 'greenhouse', tier: 1, industry: 'Defense' },
  { slug: 'flexport', name: 'Flexport', ats: 'greenhouse', tier: 1, industry: 'Logistics' },
]

// ── Tier 2: Medium-priority (established, active boards) ──
const TIER_2: DiscoveryCandidate[] = [
  { slug: 'linear', name: 'Linear', ats: 'lever', tier: 2, industry: 'Tech' },
  { slug: 'loom', name: 'Loom', ats: 'greenhouse', tier: 2, industry: 'Tech' },
  { slug: 'mux', name: 'Mux', ats: 'greenhouse', tier: 2, industry: 'Media' },
  { slug: 'sanity', name: 'Sanity', ats: 'lever', tier: 2, industry: 'CMS' },
  { slug: 'neon', name: 'Neon', ats: 'greenhouse', tier: 2, industry: 'Data' },
  { slug: 'railway', name: 'Railway', ats: 'lever', tier: 2, industry: 'Infrastructure' },
  { slug: 'fly', name: 'Fly.io', ats: 'lever', tier: 2, industry: 'Infrastructure' },
  { slug: 'replit', name: 'Replit', ats: 'greenhouse', tier: 2, industry: 'Developer Tools' },
  { slug: 'clerk', name: 'Clerk', ats: 'greenhouse', tier: 2, industry: 'Auth' },
  { slug: 'algolia', name: 'Algolia', ats: 'greenhouse', tier: 2, industry: 'Search' },
  { slug: 'sentry', name: 'Sentry', ats: 'greenhouse', tier: 2, industry: 'Observability' },
  { slug: 'postman', name: 'Postman', ats: 'greenhouse', tier: 2, industry: 'Developer Tools' },
  { slug: 'snyk', name: 'Snyk', ats: 'greenhouse', tier: 2, industry: 'Security' },
  { slug: 'mongodb', name: 'MongoDB', ats: 'greenhouse', tier: 2, industry: 'Data' },
  { slug: 'elastic', name: 'Elastic', ats: 'greenhouse', tier: 2, industry: 'Search' },
  { slug: 'twilio', name: 'Twilio', ats: 'greenhouse', tier: 2, industry: 'Communications' },
  { slug: 'zapier', name: 'Zapier', ats: 'greenhouse', tier: 2, industry: 'Automation' },
  { slug: 'webflow', name: 'Webflow', ats: 'greenhouse', tier: 2, industry: 'Design' },
  { slug: 'auth0', name: 'Auth0 (Okta)', ats: 'greenhouse', tier: 2, industry: 'Auth' },
  { slug: 'pagerduty', name: 'PagerDuty', ats: 'greenhouse', tier: 2, industry: 'Incident Management' },
  { slug: 'launchdarkly', name: 'LaunchDarkly', ats: 'greenhouse', tier: 2, industry: 'Developer Tools' },
  { slug: 'contentful', name: 'Contentful', ats: 'greenhouse', tier: 2, industry: 'CMS' },
  { slug: 'segment', name: 'Segment (Twilio)', ats: 'greenhouse', tier: 2, industry: 'Data' },
  { slug: 'mixpanel', name: 'Mixpanel', ats: 'greenhouse', tier: 2, industry: 'Analytics' },
  { slug: 'amplitude', name: 'Amplitude', ats: 'greenhouse', tier: 2, industry: 'Analytics' },
  { slug: 'dropbox', name: 'Dropbox', ats: 'greenhouse', tier: 2, industry: 'Storage' },
  { slug: 'hubspot', name: 'HubSpot', ats: 'greenhouse', tier: 2, industry: 'CRM' },
  { slug: 'asana', name: 'Asana', ats: 'greenhouse', tier: 2, industry: 'Productivity' },
  { slug: 'gitlab', name: 'GitLab', ats: 'greenhouse', tier: 2, industry: 'Developer Tools' },
  { slug: 'hashnode', name: 'Hashnode', ats: 'lever', tier: 2, industry: 'Developer Tools' },
]

// ── Tier 3: Low-priority (smaller/less-known, need validation) ──
const TIER_3: DiscoveryCandidate[] = [
  { slug: 'buildkite', name: 'Buildkite', ats: 'lever', tier: 3, industry: 'CI/CD' },
  { slug: 'render', name: 'Render', ats: 'lever', tier: 3, industry: 'Infrastructure' },
  { slug: 'planetscale', name: 'PlanetScale', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'temporal', name: 'Temporal', ats: 'greenhouse', tier: 3, industry: 'Infrastructure' },
  { slug: 'materialize', name: 'Materialize', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'prefect', name: 'Prefect', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'airbyte', name: 'Airbyte', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'dagster', name: 'Dagster', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'cohere', name: 'Cohere', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'deepgram', name: 'Deepgram', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'huggingface', name: 'Hugging Face', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'weights-and-biases', name: 'Weights & Biases', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'sourcegraph', name: 'Sourcegraph', ats: 'greenhouse', tier: 3, industry: 'Developer Tools' },
  { slug: 'gitpod', name: 'Gitpod', ats: 'lever', tier: 3, industry: 'Developer Tools' },
  { slug: 'zeplin', name: 'Zeplin', ats: 'lever', tier: 3, industry: 'Design' },
  { slug: 'stytch', name: 'Stytch', ats: 'greenhouse', tier: 3, industry: 'Auth' },
  { slug: 'postscript', name: 'Postscript', ats: 'greenhouse', tier: 3, industry: 'Marketing' },
  { slug: 'truework', name: 'Truework', ats: 'greenhouse', tier: 3, industry: 'HR Tech' },
  { slug: 'vanta', name: 'Vanta', ats: 'greenhouse', tier: 3, industry: 'Security' },
  { slug: 'lacework', name: 'Lacework', ats: 'greenhouse', tier: 3, industry: 'Security' },
  { slug: 'drata', name: 'Drata', ats: 'greenhouse', tier: 3, industry: 'Security' },
  { slug: 'kalshi', name: 'Kalshi', ats: 'greenhouse', tier: 3, industry: 'Fintech' },
  { slug: 'mercury', name: 'Mercury', ats: 'greenhouse', tier: 3, industry: 'Fintech' },
  { slug: 'pave', name: 'Pave', ats: 'greenhouse', tier: 3, industry: 'HR Tech' },
  { slug: 'hightouch', name: 'Hightouch', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'rudderstack', name: 'RudderStack', ats: 'greenhouse', tier: 3, industry: 'Data' },
  { slug: 'labelbox', name: 'Labelbox', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'roboflow', name: 'Roboflow', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'resend', name: 'Resend', ats: 'lever', tier: 3, industry: 'Developer Tools' },
  { slug: 'inngest', name: 'Inngest', ats: 'lever', tier: 3, industry: 'Developer Tools' },
  { slug: 'modal', name: 'Modal', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'replicate', name: 'Replicate', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'baseten', name: 'Baseten', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'together-ai', name: 'Together AI', ats: 'greenhouse', tier: 3, industry: 'AI' },
  { slug: 'warp', name: 'Warp', ats: 'greenhouse', tier: 3, industry: 'Developer Tools' },
  { slug: 'retool', name: 'Retool', ats: 'lever', tier: 3 },
  { slug: 'coda', name: 'Coda', ats: 'greenhouse', tier: 3, industry: 'Productivity' },
  { slug: 'notion', name: 'Notion', ats: 'lever', tier: 3 },
]

export const DISCOVERY_CANDIDATES: DiscoveryCandidate[] = [
  ...TIER_1,
  ...TIER_2,
  ...TIER_3,
]

/** Filter candidates by tier */
export function getCandidatesByTier(tier: DiscoveryTier): DiscoveryCandidate[] {
  return DISCOVERY_CANDIDATES.filter(c => c.tier === tier)
}
