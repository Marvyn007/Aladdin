# Aladdin Search Backend Architecture

## Overview
A two-stage, relevance-driven job search system inspired by LinkedIn's search behavior, built on PostgreSQL with pgvector for semantic search using free, open-source models.

## Core Architecture

### Two-Stage Search Pipeline

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: Hard Match Filter (PostgreSQL Full-Text + ILIKE) │
│  ─────────────────────────────────────────────────────────  │
│  • Exact title matches (weighted highest)                   │
│  • Company name matches                                     │
│  • Location matches (city, state, remote)                   │
│  • Partial substring matches                                │
│  • Preliminary scoring based on match quality               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: Semantic Enrichment (pgvector + Cosine Sim)       │
│  ─────────────────────────────────────────────────────────  │
│  • Query embedding via Xenova/all-MiniLM-L6-v2 (384-dim)    │
│  • Compare against pre-computed job embeddings              │
│  • Combine hard match score + semantic similarity           │
│  • Final weighted ranking                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Ranked Results with Scores & Match Categories
```

## Scoring Algorithm

### Weight Formula
```typescript
final_score = (3.0 × title_score) +
              (2.0 × company_score) +
              (1.5 × location_score) +
              (1.0 × semantic_similarity)
```

### Match Scoring Details

#### Title Scoring (Highest Priority)
- Exact match (case-insensitive): +1000 points
- Starts with query: +800 points
- Contains query as phrase: +600 points
- Contains all words (any order): +400 points
- Contains any word: +100 points per word
- Fuzzy match (Levenshtein ≤ 2): +200 points

#### Company Scoring
- Exact match: +600 points
- Contains query: +400 points
- Word-level matches: +50 points per word

#### Location Scoring
- Exact match: +450 points
- Contains city/state: +300 points
- Remote keyword match: +350 points
- Partial match: +150 points

#### Semantic Similarity (0-1 normalized)
- Cosine similarity between query embedding and job embedding
- Multiplied by 1000 for scoring parity
- Ensures semantically related jobs surface (e.g., "web developer" for "software engineer")

## Database Schema Additions

### New Columns on `jobs` Table
```sql
-- Tokenized search fields (populated on insert/update)
search_title_tokens tsvector,      -- Full-text searchable title
search_company_tokens tsvector,    -- Full-text searchable company
search_location_tokens tsvector,   -- Full-text searchable location
search_content tsvector,           -- Combined full-text index

-- Normalized fields for partial matching
title_normalized text,             -- Lowercase, trimmed title
company_normalized text,           -- Lowercase, trimmed company
location_normalized text,          -- Lowercase, trimmed location

-- Pre-computed embedding already exists in job_embeddings table
```

### Indexes
```sql
-- GIN indexes for full-text search (fast exact/phrase matching)
CREATE INDEX idx_jobs_search_title ON jobs USING GIN(search_title_tokens);
CREATE INDEX idx_jobs_search_company ON jobs USING GIN(search_company_tokens);
CREATE INDEX idx_jobs_search_location ON jobs USING GIN(search_location_tokens);
CREATE INDEX idx_jobs_search_content ON jobs USING GIN(search_content);

-- B-tree indexes for partial string matching
CREATE INDEX idx_jobs_title_normalized ON jobs(title_normalized);
CREATE INDEX idx_jobs_company_normalized ON jobs(company_normalized);
CREATE INDEX idx_jobs_location_normalized ON jobs(location_normalized);

-- Trigram indexes for fuzzy matching (pg_trgm extension)
CREATE INDEX idx_jobs_title_trgm ON jobs USING GIN(title gin_trgm_ops);
CREATE INDEX idx_jobs_company_trgm ON jobs USING GIN(company gin_trgm_ops);
```

## API Design

### Main Search Endpoint
```typescript
POST /api/search/jobs
Body: {
  query: string,           // Search query
  page?: number,           // Default: 1
  limit?: number,          // Default: 50, max: 100
  filters?: {
    location?: string,     // Filter by location
    remoteOnly?: boolean,  // Remote jobs only
    datePosted?: '24h' | '7d' | '30d' | 'all'  // Time filter
  }
}

Response: {
  jobs: SearchResultJob[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  },
  query: {
    original: string,
    normalized: string,
    embedding: number[]     // Query embedding for debugging
  },
  timing: {
    stage1_ms: number,     // Hard match time
    stage2_ms: number,     // Semantic scoring time
    total_ms: number
  }
}

SearchResultJob: Job & {
  relevanceScore: number,
  matchCategories: ('title' | 'company' | 'location' | 'semantic')[],
  matchSnippet?: string,   // Highlighted matching text
  whyMatched: {            // Breakdown for UI
    titleMatch?: boolean,
    companyMatch?: boolean,
    locationMatch?: boolean,
    semanticMatch?: number  // Similarity score
  }
}
```

### Autocomplete/Suggestions Endpoint
```typescript
GET /api/search/suggestions?query={partial}&type={all|title|company|location}&limit=10

Response: {
  suggestions: {
    titles: string[],      // Job title suggestions
    companies: string[],   // Company name suggestions
    locations: string[]    // Location suggestions
  },
  query: string,
  total: number
}
```

## Implementation Files

### Core Service Layer
```
src/lib/search/
├── types.ts              # TypeScript interfaces for search
├── tokenizer.ts          # Text normalization & tokenization
├── scoring.ts            # Match scoring algorithms
├── semantic.ts           # Vector embedding & similarity
├── fuzzy.ts              # Levenshtein & fuzzy matching
└── index.ts              # Main search orchestrator
```

### API Routes
```
src/app/api/search/
├── jobs/route.ts         # Main search endpoint
├── suggestions/route.ts  # Autocomplete endpoint
└── did-you-mean/route.ts # Query correction endpoint
```

### Database Layer (db.ts extensions)
- `searchJobs(query, filters, pagination)` - Main search function
- `getSearchSuggestions(query, limit)` - Autocomplete
- `findSimilarJobs(jobId, limit)` - "More like this"

## Tokenization Strategy

### Text Normalization Pipeline
```typescript
1. Lowercase conversion
2. Remove special characters (keep alphanumeric, spaces)
3. Standardize whitespace (multiple spaces → single)
4. Trim leading/trailing whitespace
5. Extract key tokens:
   - Role keywords: "engineer", "developer", "manager", etc.
   - Seniority: "junior", "senior", "lead", "principal"
   - Technologies: "react", "python", "aws" (from tech stack)
```

### Full-Text Search Configuration
```sql
-- Use simple configuration for job search (less aggressive stemming)
-- Preserves "engineer" vs "engineering" distinction which matters for jobs
ALTER TABLE jobs ADD COLUMN search_content tsvector 
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(job_description_plain, '')), 'D')
  ) STORED;
```

## Performance Optimizations

### Query Strategy
1. **Stage 1 (Hard Match)**: 
   - Use GIN indexes for tsvector queries
   - Limit to top 500 candidates for semantic scoring
   - Parallelize ILIKE queries with UNION ALL

2. **Stage 2 (Semantic)**:
   - Pre-compute query embedding (cache for 1 hour)
   - Use pgvector's `<=>` operator with IVFFlat index
   - Batch similarity computations

3. **Caching**:
   - Cache popular queries (Redis/memory)
   - Cache embeddings for common job titles

### Scaling Considerations
- **Vector Index**: Use IVFFlat with 100 lists for up to 100k jobs
- **Horizontal Scaling**: Read replicas for search queries
- **Background Jobs**: Pre-compute embeddings for new jobs

## Edge Cases & Fallbacks

### Empty Results
1. Try fuzzy matching with trigram similarity
2. Suggest alternative queries ("Did you mean...")
3. Return semantically similar jobs even without text matches
4. Show message: "No exact matches found. Showing related opportunities."

### Query Classification
```typescript
type QueryType = 
  | 'title_only'      // "software engineer"
  | 'company_only'    // "Google"
  | 'location_only'   // "New York"
  | 'title_company'   // "engineer at Stripe"
  | 'title_location'  // "developer in Austin"
  | 'compound'        // "senior backend engineer remote"

// Adjust scoring weights based on query type
```

### Single Term Queries
- Boost title matches even more
- Show company/location suggestions
- Allow partial matches (prefix search)

## Free Model Constraints

### Embedding Model
- **Model**: `Xenova/all-MiniLM-L6-v2` (already in use)
- **Dimensions**: 384
- **Context**: ~256 tokens (truncate safely at 8000 chars)
- **Performance**: ~50-100 embeddings/sec on CPU
- **Storage**: ~1.5KB per embedding

### No Paid Services Required
- ✅ PostgreSQL + pgvector (Neon free tier)
- ✅ Xenova transformers (local/browser)
- ✅ All ranking/scoring logic (custom implementation)
- ✅ Full-text search (PostgreSQL built-in)
- ❌ No OpenAI/Anthropic/Cohere embeddings
- ❌ No Algolia/Elasticsearch (unless scaling requires)

## Result Quality Metrics

### Target Behavior
| Query | Expected Top Results |
|-------|---------------------|
| "software engineer" | Exact title matches → similar roles (developer, programmer) |
| "Stripe" | All Stripe jobs (any title) |
| "New York" | NYC jobs across all roles |
| "senior backend" | Senior backend roles, backend senior roles |
| "react remote" | Remote React jobs, React engineer remote |
| "product manager" | PM roles, product owner, technical PM |

### Scoring Benchmarks
- Exact title match: Score ≥ 3000 (guaranteed top 10)
- Strong semantic match: Score 1500-2500
- Partial match: Score 500-1500
- Weak/fuzzy match: Score 100-500

## Migration Path

1. **Phase 1**: Add new columns and indexes (no downtime)
2. **Phase 2**: Backfill tokens for existing jobs (background job)
3. **Phase 3**: Implement search service with feature flag
4. **Phase 4**: Switch SearchBar to use new API
5. **Phase 5**: Deprecate client-side search

## Testing Strategy

### Unit Tests
- Tokenization edge cases
- Scoring formula accuracy
- Fuzzy matching thresholds

### Integration Tests
- End-to-end search queries
- Performance benchmarks (< 200ms for 95th percentile)
- Relevance validation (manual QA set)

### Load Tests
- 100 concurrent searches
- 10k job dataset
- Measure P50, P95, P99 latency
