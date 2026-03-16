/**
 * Score Jobs Pipeline - Skill Normalization & Taxonomy
 * 
 * Provides deterministic skill matching with normalization, synonyms,
 * and basic similarity fallback.
 */

// ============================================================================
// CANONICAL SKILL TAXONOMY
// ============================================================================

const CANONICAL_SKILLS: Record<string, string> = {
  // Programming Languages
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  python: 'python',
  java: 'java',
  'c++': 'c++',
  cpp: 'c++',
  'c#': 'c#',
  csharp: 'c#',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  r: 'r',
  matlab: 'matlab',
  perl: 'perl',
  haskell: 'haskell',
  elixir: 'elixir',
  clojure: 'clojure',
  dart: 'dart',
  c: 'c',
  'objective-c': 'objective-c',
  assembly: 'assembly',
  cobol: 'cobol',
  fortran: 'fortran',
  lua: 'lua',
  groovy: 'groovy',
  julia: 'julia',
  fsharp: 'f#',
  'f#': 'f#',

  // Frontend Frameworks & Libraries
  react: 'react',
  'react.js': 'react',
  angular: 'angular',
  vue: 'vue',
  'vue.js': 'vue',
  vuejs: 'vue',
  svelte: 'svelte',
  ember: 'ember',
  jquery: 'jquery',
  backbone: 'backbone',
  redux: 'redux',
  mobx: 'mobx',
  zustand: 'zustand',
  recoil: 'recoil',
  graphql: 'graphql',
  apollo: 'apollo',
  webpack: 'webpack',
  vite: 'vite',
  rollup: 'rollup',
  parcel: 'parcel',
  babel: 'babel',
  eslint: 'eslint',
  prettier: 'prettier',
  'next.js': 'next.js',
  nextjs: 'next.js',
  nuxt: 'nuxt',
  nuxtjs: 'nuxt',

  // Node.js
  'node.js': 'node.js',
  nodejs: 'node.js',
  express: 'express',
  fastify: 'fastify',
  koa: 'koa',
  nestjs: 'nestjs',
  deno: 'deno',
  bun: 'bun',

  // CSS & Styling
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  tailwind: 'tailwind',
  tailwindcss: 'tailwind',
  bootstrap: 'bootstrap',
  'material-ui': 'material-ui',
  mui: 'material-ui',
  'chakra ui': 'chakra',
  antd: 'ant design',
  'ant design': 'ant design',
  'styled-components': 'styled-components',
  emotion: 'emotion',

  // Python Frameworks
  django: 'django',
  flask: 'flask',
  fastapi: 'fastapi',
  pyramid: 'pyramid',
  tornado: 'tornado',
  celery: 'celery',

  // Data Science & ML
  numpy: 'numpy',
  pandas: 'pandas',
  scipy: 'scipy',
  matplotlib: 'matplotlib',
  seaborn: 'seaborn',
  plotly: 'plotly',
  tensorflow: 'tensorflow',
  pytorch: 'pytorch',
  keras: 'keras',
  'scikit-learn': 'scikit-learn',
  sklearn: 'scikit-learn',
  xgboost: 'xgboost',
  lightgbm: 'lightgbm',
  opencv: 'opencv',
  nltk: 'nltk',
  spacy: 'spacy',
  'hugging face': 'hugging face',
  transformers: 'transformers',
  'machine learning': 'machine learning',
  ml: 'machine learning',
  'deep learning': 'deep learning',
  dl: 'deep learning',
  ai: 'artificial intelligence',
  'artificial intelligence': 'artificial intelligence',
  nlp: 'nlp',
  'natural language processing': 'nlp',
  'computer vision': 'computer vision',
  cv: 'computer vision',
  'data science': 'data science',
  'data engineering': 'data engineering',
  etl: 'etl',

  // Java/JVM
  spring: 'spring',
  'spring boot': 'spring boot',
  hibernate: 'hibernate',
  maven: 'maven',
  gradle: 'gradle',
  junit: 'junit',
  mockito: 'mockito',
  tomcat: 'tomcat',
  jetty: 'jetty',
  jboss: 'jboss',
  wildfly: 'wildfly',
  glassfish: 'glassfish',

  // Databases
  sql: 'sql',
  mysql: 'mysql',
  postgresql: 'postgresql',
  postgres: 'postgresql',
  sqlite: 'sqlite',
  mariadb: 'mariadb',
  oracle: 'oracle',
  'sql server': 'sql server',
  mssql: 'sql server',
  mongodb: 'mongodb',
  redis: 'redis',
  cassandra: 'cassandra',
  dynamodb: 'dynamodb',
  couchdb: 'couchdb',
  neo4j: 'neo4j',
  elasticsearch: 'elasticsearch',
  firebase: 'firebase',
  supabase: 'supabase',
  planetscale: 'planetscale',
  prisma: 'prisma',
  sequelize: 'sequelize',
  typeorm: 'typeorm',
  drizzle: 'drizzle',

  // Cloud & DevOps
  aws: 'aws',
  'amazon web services': 'aws',
  azure: 'azure',
  gcp: 'gcp',
  'google cloud': 'gcp',
  heroku: 'heroku',
  vercel: 'vercel',
  netlify: 'netlify',
  docker: 'docker',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  terraform: 'terraform',
  ansible: 'ansible',
  puppet: 'puppet',
  chef: 'chef',
  jenkins: 'jenkins',
  circleci: 'circleci',
  'travis ci': 'travis ci',
  'github actions': 'github actions',
  'gitlab ci': 'gitlab ci',
  argocd: 'argocd',
  nginx: 'nginx',
  apache: 'apache',
  caddy: 'caddy',
  haproxy: 'haproxy',
  linux: 'linux',
  ubuntu: 'ubuntu',
  centos: 'centos',
  debian: 'debian',
  redhat: 'redhat',
  unix: 'unix',
  bash: 'bash',
  shell: 'shell',

  // APIs & Protocols
  rest: 'rest',
  restful: 'rest',
  grpc: 'grpc',
  websocket: 'websocket',
  soap: 'soap',
  json: 'json',
  xml: 'xml',
  protobuf: 'protobuf',
  oauth: 'oauth',
  jwt: 'jwt',
  saml: 'saml',
  openid: 'openid',

  // Testing
  jest: 'jest',
  mocha: 'mocha',
  chai: 'chai',
  jasmine: 'jasmine',
  cypress: 'cypress',
  playwright: 'playwright',
  selenium: 'selenium',
  puppeteer: 'puppeteer',
  pytest: 'pytest',
  unittest: 'unittest',
  rspec: 'rspec',
  testng: 'testng',

  // Mobile
  'react native': 'react native',
  flutter: 'flutter',
  ionic: 'ionic',
  xamarin: 'xamarin',
  swiftui: 'swiftui',
  'jetpack compose': 'jetpack compose',
  ios: 'ios',
  android: 'android',
  xcode: 'xcode',
  'android studio': 'android studio',

  // Data Pipeline
  hadoop: 'hadoop',
  spark: 'spark',
  kafka: 'kafka',
  airflow: 'airflow',
  snowflake: 'snowflake',
  databricks: 'databricks',
  bigquery: 'bigquery',
  redshift: 'redshift',

  // Design Tools
  figma: 'figma',
  sketch: 'sketch',
  'adobe xd': 'adobe xd',
  photoshop: 'photoshop',
  illustrator: 'illustrator',
  framer: 'framer',
  'framer motion': 'framer motion',
  gsap: 'gsap',
  'three.js': 'three.js',
  d3: 'd3',
  'd3.js': 'd3',

  // Services
  stripe: 'stripe',
  twilio: 'twilio',
  sendgrid: 'sendgrid',
  auth0: 'auth0',
  clerk: 'clerk',

  // Version Control
  git: 'git',
  github: 'github',
  gitlab: 'gitlab',
  bitbucket: 'bitbucket',
  svn: 'svn',
  mercurial: 'mercurial',

  // Methodologies
  agile: 'agile',
  scrum: 'scrum',
  kanban: 'kanban',
  cicd: 'ci/cd',
  'ci/cd': 'ci/cd',
  devops: 'devops',
  tdd: 'tdd',
  bdd: 'bdd',
  microservices: 'microservices',
  serverless: 'serverless',
  soa: 'soa',
  'event-driven': 'event-driven',

  // Security
  security: 'security',
  cybersecurity: 'cybersecurity',
  'penetration testing': 'penetration testing',
  owasp: 'owasp',
  ssl: 'ssl',
  tls: 'tls',
  encryption: 'encryption',
};

// Skill synonyms mapping
const SKILL_SYNONYMS: Record<string, string[]> = {
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  python: ['py', 'python3'],
  'c++': ['cpp', 'c plus plus'],
  'c#': ['csharp', 'c sharp'],
  go: ['golang', 'go lang'],
  rust: ['rustlang'],
  ruby: ['ruby on rails', 'ror'],
  php: ['php7', 'php8'],
  swift: ['swiftlang'],
  kotlin: ['kotlinlang'],
  react: ['reactjs', 'react.js', 'reactjs'],
  angular: ['angularjs', 'angular.js', 'angular2', 'angular4'],
  vue: ['vuejs', 'vue.js', 'vue2', 'vue3'],
  'node.js': ['node', 'nodejs'],
  'next.js': ['nextjs', 'next'],
  django: ['django-rest-framework', 'drf'],
  postgresql: ['postgres', 'pgsql'],
  sql: ['tsql', 'plsql', 'mysql'],
  mongodb: ['mongo'],
  docker: ['dockerfile', 'docker-compose'],
  kubernetes: ['k8s', 'kube'],
  aws: ['amazon web services', 'aws services'],
  machine_learning: ['ml', 'mlops'],
  ml_ops: ['ai', 'ml'],
};

// Industry normalization
const INDUSTRY_TAXONOMY: Record<string, string> = {
  'software engineering': 'software',
  'software development': 'software',
  'software': 'software',
  'tech': 'technology',
  'technology': 'technology',
  'it': 'technology',
  'information technology': 'technology',
  'fintech': 'finance',
  'financial technology': 'finance',
  finance: 'finance',
  banking: 'finance',
  'financial services': 'finance',
  healthcare: 'healthcare',
  'health tech': 'healthcare',
  'healthtech': 'healthcare',
  medical: 'healthcare',
  biotech: 'biotechnology',
  biotech2: 'biotechnology',
  ecommerce: 'e-commerce',
  'e-commerce': 'e-commerce',
  retail: 'retail',
  education: 'education',
  edtech: 'education',
  'real estate': 'real estate',
  'realestate': 'real estate',
  marketing: 'marketing',
  advertising: 'advertising',
  media: 'media',
  entertainment: 'media',
  gaming: 'gaming',
  'game development': 'gaming',
  'video games': 'gaming',
  'mobile apps': 'mobile',
  'mobile development': 'mobile',
  'saas': 'saas',
  'software as a service': 'saas',
  blockchain: 'blockchain',
  crypto: 'blockchain',
  cryptocurrency: 'blockchain',
  'data science': 'data science',
  'data engineering': 'data engineering',
  analytics: 'analytics',
  'business intelligence': 'analytics',
  consulting: 'consulting',
  'professional services': 'consulting',
  manufacturing: 'manufacturing',
  logistics: 'logistics',
  'supply chain': 'logistics',
  transportation: 'transportation',
  telecom: 'telecommunications',
  telecommunications: 'telecommunications',
  government: 'government',
  'public sector': 'government',
  nonprofit: 'nonprofit',
  'non-profit': 'nonprofit',
};

// Related industries mapping
const RELATED_INDUSTRIES: Record<string, string[]> = {
  software: ['technology', 'saas', 'it'],
  technology: ['software', 'saas', 'it'],
  finance: ['fintech', 'banking'],
  fintech: ['finance', 'banking'],
  healthcare: ['healthtech', 'medical'],
  healthtech: ['healthcare', 'medical'],
  data_science: ['analytics', 'data_engineering'],
  data_engineering: ['data_science', 'analytics'],
  gaming: ['entertainment', 'mobile'],
  mobile: ['gaming', 'mobile apps'],
};

// Embedding cache for semantic matching
let embeddingCache: Map<string, number[]> = new Map();
const EMBEDDING_CACHE_MAX = 500;

/**
 * Normalize a skill string to canonical form
 */
export function normalizeSkill(skill: string): string {
  const normalized = skill.toLowerCase().trim()
    .replace(/[^a-z0-9\s#+.]/g, '')
    .replace(/\s+/g, ' ');
  
  // Check exact match
  if (CANONICAL_SKILLS[normalized]) {
    return CANONICAL_SKILLS[normalized];
  }

  // Check partial matches
  for (const [canonical, _] of Object.entries(CANONICAL_SKILLS)) {
    if (canonical.includes(normalized) || normalized.includes(canonical)) {
      return canonical;
    }
  }

  // Check synonyms
  for (const [canonical, syns] of Object.entries(SKILL_SYNONYMS)) {
    if (syns.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Check if skill matches using exact or fuzzy matching
 */
export function skillsMatch(
  jobSkill: string,
  candidateSkill: string,
  llmConfidence: number,
  embeddingSimilarity?: number
): { isMatch: boolean; confidence: number } {
  const normalizedJob = normalizeSkill(jobSkill);
  const normalizedCandidate = normalizeSkill(candidateSkill);

  // Exact match
  if (normalizedJob === normalizedCandidate) {
    return { isMatch: true, confidence: 1.0 };
  }

  // Synonym match
  const jobSyns = SKILL_SYNONYMS[normalizedJob] || [];
  const candidateSyns = SKILL_SYNONYMS[normalizedCandidate] || [];
  
  if (jobSyns.includes(normalizedCandidate) || candidateSyns.includes(normalizedJob)) {
    return { isMatch: true, confidence: 0.9 };
  }

  // Embedding similarity fallback
  if (embeddingSimilarity !== undefined) {
    const threshold = llmConfidence < 0.8 ? 0.82 : 0.80;
    if (embeddingSimilarity >= threshold) {
      return { isMatch: true, confidence: embeddingSimilarity };
    }
  }

  // Low confidence LLM match requires stronger validation
  if (llmConfidence < 0.8 && embeddingSimilarity !== undefined) {
    return { isMatch: false, confidence: embeddingSimilarity };
  }

  return { isMatch: false, confidence: 0 };
}

/**
 * Normalize industry string to canonical form
 */
export function normalizeIndustry(industry: string): string | null {
  const normalized = industry.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

  if (INDUSTRY_TAXONOMY[normalized]) {
    return INDUSTRY_TAXONOMY[normalized];
  }

  // Check partial matches
  for (const [canonical, _] of Object.entries(INDUSTRY_TAXONOMY)) {
    if (canonical.includes(normalized) || normalized.includes(canonical)) {
      return canonical;
    }
  }

  return null;
}

/**
 * Check if industries match (exact or related)
 */
export function industriesMatch(
  jobIndustry: string | null,
  candidateIndustry: string[] | null
): { isMatch: boolean; score: number } {
  if (!jobIndustry || !candidateIndustry || candidateIndustry.length === 0) {
    return { isMatch: false, score: 0 };
  }

  const normalizedJob = normalizeIndustry(jobIndustry);
  if (!normalizedJob) {
    return { isMatch: false, score: 0 };
  }

  for (const candIndustry of candidateIndustry) {
    const normalizedCand = normalizeIndustry(candIndustry);
    if (!normalizedCand) continue;

    // Exact match
    if (normalizedJob === normalizedCand) {
      return { isMatch: true, score: 1.0 };
    }

    // Related industries
    const related = RELATED_INDUSTRIES[normalizedJob] || [];
    if (related.includes(normalizedCand)) {
      return { isMatch: true, score: 0.6 };
    }
  }

  return { isMatch: false, score: 0 };
}

/**
 * Get embedding for skill (placeholder - use actual embedding service)
 * In production, this would call an embedding API
 */
export async function getSkillEmbedding(skill: string): Promise<number[]> {
  // This is a placeholder. In production, integrate with actual embedding service
  // For now, return a simple hash-based vector for demonstration
  const cacheKey = skill.toLowerCase().trim();
  
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // Simple deterministic hash for demo purposes
  // In production, use actual embeddings (e.g., OpenAI, Xenova, etc.)
  const hash = hashString(cacheKey);
  const vector: number[] = [];
  for (let i = 0; i < 384; i++) {
    vector.push(((hash >> i) % 2) * 2 - 1);
  }

  // Cache management
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(cacheKey, vector);

  return vector;
}

/**
 * Simple string hash for demo embedding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Simple cosine similarity for vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate semantic similarity between two skills using embeddings
 */
export async function calculateSkillSimilarity(
  skill1: string,
  skill2: string
): Promise<number> {
  const [emb1, emb2] = await Promise.all([
    getSkillEmbedding(skill1),
    getSkillEmbedding(skill2)
  ]);

  return cosineSimilarity(emb1, emb2);
}

/**
 * Match skills with fallback to embedding similarity
 */
export async function matchSkillWithFallback(
  jobSkill: string,
  candidateSkills: string[],
  llmConfidence: number
): Promise<{ isMatch: boolean; matchConfidence: number; matchedSkill?: string }> {
  // First try deterministic matching
  for (const candSkill of candidateSkills) {
    const result = skillsMatch(jobSkill, candSkill, llmConfidence);
    if (result.isMatch) {
      return { isMatch: true, matchConfidence: result.confidence, matchedSkill: candSkill };
    }
  }

  // Fallback to embedding similarity
  for (const candSkill of candidateSkills) {
    try {
      const similarity = await calculateSkillSimilarity(jobSkill, candSkill);
      const threshold = llmConfidence < 0.8 ? 0.82 : 0.80;
      
      if (similarity >= threshold) {
        return { isMatch: true, matchConfidence: similarity, matchedSkill: candSkill };
      }
    } catch (error) {
      console.warn('[ScoreJobs] Embedding similarity error:', error);
    }
  }

  return { isMatch: false, matchConfidence: 0 };
}

/**
 * Get all unique canonical skills from a list
 */
export function getCanonicalSkills(skills: string[]): string[] {
  const canonical = new Set<string>();
  for (const skill of skills) {
    const normalized = normalizeSkill(skill);
    if (normalized) {
      canonical.add(normalized);
    }
  }
  return Array.from(canonical);
}
