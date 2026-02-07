/**
 * Search Tokenizer
 * Normalizes and tokenizes search queries and job text for matching
 */

import type { TokenizedQuery, QueryClassification, QueryType } from './types';
import { expandQueryWithSynonyms, getSynonyms, isAbbreviation, getPrimaryExpansion } from './synonyms';

// Common role keywords for classification
const ROLE_KEYWORDS = [
  'engineer', 'developer', 'programmer', 'architect', 'manager', 'director',
  'analyst', 'designer', 'specialist', 'coordinator', 'lead', 'head',
  'consultant', 'administrator', 'technician', 'associate', 'intern',
  'frontend', 'backend', 'fullstack', 'full-stack', 'full stack',
  'software', 'web', 'mobile', 'devops', 'data', 'security', 'cloud',
  'product', 'project', 'program', 'qa', 'test', 'support', 'sales',
  'marketing', 'operations', 'hr', 'finance', 'legal', 'research'
];

// Seniority levels
const SENIORITY_KEYWORDS = [
  'senior', 'sr', 's', 'junior', 'jr', 'j', 'lead', 'principal', 'staff',
  'chief', 'head', 'vice president', 'vp', 'director', 'manager',
  'entry level', 'mid level', 'mid-level', 'experienced', 'associate'
];

// Common technology keywords
const TECH_KEYWORDS = [
  'react', 'vue', 'angular', 'svelte', 'javascript', 'typescript', 'js', 'ts',
  'python', 'java', 'go', 'golang', 'rust', 'c++', 'c#', 'ruby', 'php', 'swift',
  'kotlin', 'scala', 'r', 'matlab', 'sql', 'nosql', 'mongodb', 'postgres',
  'mysql', 'redis', 'elasticsearch', 'aws', 'azure', 'gcp', 'docker',
  'kubernetes', 'k8s', 'terraform', 'jenkins', 'github', 'gitlab', 'git',
  'machine learning', 'ml', 'ai', 'data science', 'blockchain', 'web3'
];

// Location indicators
const LOCATION_INDICATORS = [
  'in', 'at', 'near', 'around', 'within', 'remote', 'onsite', 'on-site', 'hybrid'
];

// Company indicators
const COMPANY_INDICATORS = [
  'at', 'with', 'for', '@'
];

/**
 * Normalizes text for search matching
 * - Lowercases
 * - Removes special characters
 * - Standardizes whitespace
 * - Trims
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')  // Replace special chars with space
    .replace(/\s+/g, ' ')              // Collapse multiple spaces
    .trim();
}

/**
 * Extracts tokens from text
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(/\s+/)
    .filter(token => token.length > 1);  // Filter single chars
}

/**
 * Extracts multi-word phrases from text (2-3 words)
 */
export function extractPhrases(text: string): string[] {
  const tokens = tokenize(text);
  const phrases: string[] = [];

  // Extract 2-word phrases
  for (let i = 0; i < tokens.length - 1; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  // Extract 3-word phrases
  for (let i = 0; i < tokens.length - 2; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  return phrases;
}

/**
 * Classifies a query to understand user intent
 */
export function classifyQuery(query: string): QueryClassification {
  const normalized = normalizeText(query);
  const tokens = tokenize(normalized);
  const lowerQuery = normalized.toLowerCase();

  const result: QueryClassification = {
    type: 'compound',
    confidence: 0.5,
    tokens: {
      title: [],
      company: [],
      location: [],
      other: []
    }
  };

  // Check for location indicators
  let hasLocation = false;
  for (const indicator of LOCATION_INDICATORS) {
    if (lowerQuery.includes(indicator)) {
      hasLocation = true;
      // Extract location (text after indicator)
      const idx = lowerQuery.indexOf(indicator);
      const after = lowerQuery.slice(idx + indicator.length).trim();
      if (after) {
        result.tokens.location!.push(after.split(' ')[0]);
      }
    }
  }

  // Check for company indicators
  let hasCompany = false;
  for (const indicator of COMPANY_INDICATORS) {
    if (lowerQuery.includes(` ${indicator} `)) {
      hasCompany = true;
      // Extract potential company (text after indicator)
      const parts = lowerQuery.split(` ${indicator} `);
      if (parts.length > 1) {
        const potentialCompany = parts[1].split(' ')[0];
        if (potentialCompany && !ROLE_KEYWORDS.includes(potentialCompany)) {
          result.tokens.company!.push(potentialCompany);
        }
      }
    }
  }

  // Check for role/technology keywords
  let hasTitle = false;
  for (const token of tokens) {
    if (ROLE_KEYWORDS.some(role => token.includes(role) || role.includes(token))) {
      hasTitle = true;
      result.tokens.title!.push(token);
    }
    if (TECH_KEYWORDS.some(tech => token.includes(tech) || tech.includes(token))) {
      hasTitle = true;
      result.tokens.title!.push(token);
    }
  }

  // Determine query type
  if (hasTitle && hasCompany && hasLocation) {
    result.type = 'compound';
    result.confidence = 0.9;
  } else if (hasTitle && hasCompany) {
    result.type = 'title_company';
    result.confidence = 0.85;
  } else if (hasTitle && hasLocation) {
    result.type = 'title_location';
    result.confidence = 0.85;
  } else if (hasCompany && hasLocation) {
    result.type = 'company_location';
    result.confidence = 0.8;
  } else if (hasTitle) {
    result.type = 'title_only';
    result.confidence = 0.9;
  } else if (hasCompany) {
    result.type = 'company_only';
    result.confidence = 0.8;
  } else if (hasLocation) {
    result.type = 'location_only';
    result.confidence = 0.8;
  }

  // Collect other tokens
  result.tokens.other = tokens.filter(t =>
    !result.tokens.title?.includes(t) &&
    !result.tokens.company?.includes(t) &&
    !result.tokens.location?.includes(t)
  );

  return result;
}

/**
 * Creates a tokenized query object with full analysis
 */
export function createTokenizedQuery(query: string): TokenizedQuery {
  const normalized = normalizeText(query);
  const tokens = tokenize(normalized);
  const phrases = extractPhrases(normalized);
  const classification = classifyQuery(query);

  return {
    original: query,
    normalized,
    tokens,
    phrases,
    categories: {
      role: classification.tokens.title,
      seniority: tokens.filter(t => SENIORITY_KEYWORDS.some(s => t.includes(s))),
      technology: tokens.filter(t => TECH_KEYWORDS.some(tech => t.includes(tech))),
      company: classification.tokens.company,
      location: classification.tokens.location
    }
  };
}

/**
 * Creates a tokenized query with synonym expansion for better search coverage
 * Expands abbreviations and adds synonyms to improve recall
 */
export function createExpandedTokenizedQuery(query: string): TokenizedQuery & {
  expandedTokens: string[];
  expandedQueries: string[];
  primaryExpansion?: string;
} {
  const base = createTokenizedQuery(query);

  // Expand query with synonyms
  const expandedQueries = expandQueryWithSynonyms(query);

  // Collect all tokens from expanded queries
  const expandedTokens = new Set<string>();
  base.tokens.forEach(t => expandedTokens.add(t));

  expandedQueries.forEach(eq => {
    tokenize(eq).forEach(t => expandedTokens.add(t));
  });

  // Add synonyms for each original token
  base.tokens.forEach(token => {
    getSynonyms(token).forEach(syn => {
      tokenize(syn).forEach(t => expandedTokens.add(t));
    });
  });

  // Check for abbreviation expansion
  const primaryExpansion = isAbbreviation(query) ? getPrimaryExpansion(query) || undefined : undefined;

  return {
    ...base,
    expandedTokens: Array.from(expandedTokens),
    expandedQueries,
    primaryExpansion
  };
}

// Re-export synonym functions for convenience
export { expandQueryWithSynonyms, getSynonyms, isAbbreviation, getPrimaryExpansion } from './synonyms';

/**
 * Checks if text contains all tokens (AND logic)
 */
export function containsAllTokens(text: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const normalized = normalizeText(text);
  return tokens.every(token => normalized.includes(token));
}

/**
 * Checks if text contains any token (OR logic)
 */
export function containsAnyToken(text: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const normalized = normalizeText(text);
  return tokens.some(token => normalized.includes(token));
}

/**
 * Calculates how many tokens match (for scoring)
 */
export function countMatchingTokens(text: string, tokens: string[]): number {
  const normalized = normalizeText(text);
  return tokens.filter(token => normalized.includes(token)).length;
}

/**
 * Generates search patterns for SQL queries
 * Creates patterns like: %word1%,%word2% for ILIKE ANY queries
 */
export function generateSqlPatterns(tokens: string[]): string[] {
  return tokens.map(token => `%${token}%`);
}

/**
 * Extracts the "best" phrase from a query (for highlighting)
 */
export function extractBestPhrase(query: string): string {
  const phrases = extractPhrases(query);
  if (phrases.length === 0) return query;

  // Prefer phrases with role keywords
  for (const phrase of phrases) {
    if (ROLE_KEYWORDS.some(role => phrase.includes(role))) {
      return phrase;
    }
  }

  return phrases[0];
}

/**
 * Detects if a query might be a company name
 * (Capitalized words without common role terms)
 */
export function isLikelyCompanyName(query: string): boolean {
  const normalized = normalizeText(query);
  const tokens = tokenize(normalized);

  // If it contains role keywords, probably not a company
  if (tokens.some(t => ROLE_KEYWORDS.includes(t))) {
    return false;
  }

  // If it contains tech keywords, probably not a company
  if (tokens.some(t => TECH_KEYWORDS.includes(t))) {
    return false;
  }

  // If original has capital letters (proper noun style), likely a company
  if (/[A-Z]{2,}/.test(query) || /^[A-Z][a-z]+/.test(query)) {
    return true;
  }

  return tokens.length <= 2;
}

/**
 * Detects if a query might be a location
 */
export function isLikelyLocation(query: string): boolean {
  const normalized = normalizeText(query);
  const locationPatterns = [
    /\b(remote|hybrid|onsite|on-site)\b/i,
    /\b([a-z]+\s)?(new york|san francisco|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|san francisco|indianapolis|seattle|denver|washington|boston|el paso|detroit|nashville|oklahoma city|las vegas|louisville|baltimore|milwaukee|albuquerque|tucson|fresno|sacramento|mesa|kansas city|atlanta|long beach|colorado springs|raleigh|omaha|miami|oakland|minneapolis|tulsa|cleveland|wichita|arlington|new orleans|bakersfield|tampa|honolulu|anaheim|aurora|santa ana|st\.? louis|riverside|corpus christi|lexington|pittsburgh|anchorage|stockton|cincinnati|st\.? paul|toledo|newark|greensboro|plano|henderson|lincoln|buffalo|jersey city|chula vista|fort wayne|orlando|st\.? petersburg|chandler|laredo|norfolk|durham|madison|lubbock|irvine|winston-salem|glendale|garland|hialeah|reno|chesapeake|gilbert|baton rouge|irving|scottsdale|north las vegas|fremont|boise|richmond|san bernardino|birmingham|spokane|rochester|des moines|modesto|fayetteville|tacoma|oxnard|fontana|columbus|montgomery|moreno valley|shreveport|aurora|yonkers|akron|huntington beach|little rock|augusta|amarillo|glendale|mobile|grand rapids|salt lake city|tallahassee|huntsville|grand prairie|knoxville|worcester|newport news|brownsville|overland park|santa clarita|providence|garden grove|chattanooga|oceanside|jackson|fort lauderdale|santa rosa|rancho cucamonga|port st\.? lucie|tempe|ontario|vancouver|cape coral|sioux falls|springfield|pembroke pines|elk grove|salem|lancaster|corona|eugene|palmdale|salinas|springfield|pasadena|rockford|joliet|paterson|bridgeport|syracuse|hayward|alexandria|lakewood|newport beach)\b/i,
    /\b(ca|ny|tx|fl|il|pa|oh|ga|nc|mi|nj|va|wa|az|ma|tn|in|mo|md|wi|co|mn|sc|al|la|ky|or|ok|ct|ut|ia|nv|ar|ms|ks|nm|ne|wv|id|hi|nh|me|mt|ri|de|sd|nd|ak|vt|wy)\b/i,
    /\b(united states|usa|america|canada|uk|united kingdom|germany|france|spain|italy|netherlands|australia|japan|singapore|india|china|brazil|mexico)\b/i
  ];

  return locationPatterns.some(pattern => pattern.test(normalized));
}
