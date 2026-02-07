# Enhanced Job Search System

A bulletproof, multi-layer search system that **ALWAYS** returns relevant job results, even when no exact matches exist.

## Overview

This search system implements a 6-layer fallback architecture that progressively relaxes search criteria until results are found. It combines PostgreSQL's powerful full-text search, fuzzy matching with pg_trgm, and semantic search with pgvector to deliver LinkedIn-quality search results.

## Architecture

### Six-Layer Search Strategy

The search system uses the following layers, each with fallback to the next:

1. **Exact & Prefix Matches** (Layer 1)
   - Exact normalized text matches on title, company, location
   - Prefix matching for partial queries
   - Highest priority scoring
   - Uses indexed normalized columns

2. **Full-Text Search** (Layer 2)
   - PostgreSQL tsvector/tsquery with weighted fields
   - Title (weight A), Company (weight B), Location (weight C), Description (weight D)
   - Fast GIN index lookups
   - Ranked by relevance score

3. **Fuzzy Search** (Layer 3)
   - pg_trgm trigram similarity for typo tolerance
   - Handles misspellings like "sofware" → "software"
   - Similarity threshold: 0.3+
   - Provides "Did you mean?" suggestions

4. **Semantic Search** (Layer 4)
   - pgvector cosine similarity on 384-dimensional embeddings
   - Finds jobs with similar meaning even with different keywords
   - Example: "software engineering intern" → "Software Engineer", "Developer Intern"
   - Uses HNSW index for fast approximate nearest neighbor search

5. **Broad Token Match** (Layer 5)
   - Matches ANY query token in title, company, or location
   - OR logic for partial matches
   - Ensures we catch related terms

6. **Default Results** (Layer 6)
   - Most recent jobs as final fallback
   - **Guarantees at least 10 results minimum**
   - Never returns empty

### Hybrid Scoring

Results are scored using a hybrid formula combining:
- **Text Relevance (60%)**: Full-text search + token matching scores
- **Semantic Similarity (40%)**: Vector cosine similarity
- **Layer Bonus**: Higher priority layers get score boosts

```
Final Score = (TextScore × 0.6) + (SemanticScore × 0.4) + LayerBonus
```

## Database Schema

### Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Fuzzy matching
CREATE EXTENSION IF NOT EXISTS vector;     -- Vector embeddings
```

### Key Indexes

1. **Normalized Text Indexes**
   - `idx_jobs_title_normalized` - For exact/prefix matches
   - `idx_jobs_company_normalized`
   - `idx_jobs_location_normalized`

2. **Full-Text Search Indexes (GIN)**
   - `idx_jobs_fts_comprehensive` - Combined tsvector on all fields

3. **Fuzzy Search Indexes (GIN with trigram)**
   - `idx_jobs_title_trgm` - For similarity() and % operator
   - `idx_jobs_company_trgm`
   - `idx_jobs_location_trgm`

4. **Vector Index (HNSW)**
   - `idx_job_embeddings_embedding_hnsw` - Fast ANN search with cosine similarity

5. **Composite Indexes**
   - `idx_jobs_title_posted` - For title + date filtering
   - `idx_jobs_posted_at_recent` - For recent jobs fallback

## API Endpoints

### POST /api/search/jobs

Main search endpoint with guaranteed results.

**Request:**
```json
{
  "query": "software engineering intern",
  "page": 1,
  "limit": 50,
  "filters": {
    "location": "San Francisco",
    "remoteOnly": false,
    "datePosted": "30d"
  },
  "useEnhanced": true
}
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "title": "Software Engineering Intern",
      "company": "TechCorp",
      "location": "San Francisco, CA",
      "relevanceScore": 2450,
      "matchCategories": ["title", "semantic"],
      "matchSnippet": "Title: Software Engineering Intern",
      "whyMatched": {
        "titleMatch": true,
        "semanticMatch": 0.85
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 42,
    "totalPages": 1
  },
  "query": {
    "original": "software engineering intern",
    "normalized": "software engineering intern",
    "embedding": [...],
    "queryType": "title_only"
  },
  "timing": {
    "stage1_ms": 45,
    "stage2_ms": 120,
    "total_ms": 165
  },
  "didYouMean": null,
  "fallbackUsed": false,
  "layersUsed": ["exact_prefix", "full_text"],
  "totalCandidates": 156
}
```

### GET /api/search/suggestions

Autocomplete endpoint with guaranteed suggestions.

**Query Parameters:**
- `query` (string): Partial search text
- `type` (string): 'all' | 'title' | 'company' | 'location'
- `limit` (number): Max suggestions per category (default: 10)

**Response:**
```json
{
  "suggestions": {
    "titles": ["Software Engineer", "Software Engineering Intern", "Senior Software Engineer"],
    "companies": ["Google", "Microsoft", "Amazon"],
    "locations": ["San Francisco", "New York", "Remote"]
  },
  "query": "soft",
  "total": 12,
  "didYouMean": null,
  "fallbackUsed": false
}
```

## Usage Examples

### Basic Search

```typescript
import { searchJobsEnhanced } from '@/lib/search/enhanced';

const results = await searchJobsEnhanced({
  query: 'software engineer',
  page: 1,
  limit: 50
});

// Always has results
console.log(results.jobs.length); // >= 10 (guaranteed)
```

### With Filters

```typescript
const results = await searchJobsEnhanced({
  query: 'frontend developer',
  filters: {
    location: 'New York',
    remoteOnly: true,
    datePosted: '7d'  // Last 7 days
  }
});
```

### Get Suggestions

```typescript
const response = await fetch('/api/search/suggestions?query=soft&limit=5');
const { suggestions } = await response.json();

// suggestions.titles: ["Software Engineer", "Software Developer", ...]
```

## Configuration

### Search Weights

Edit `src/lib/search/types.ts`:

```typescript
export const DEFAULT_WEIGHTS: ScoringWeights = {
  title: 3.0,      // Title matches weighted highest
  company: 2.0,    // Company matches
  location: 1.5,   // Location matches
  semantic: 1.0,   // Semantic similarity
};
```

### Minimum Results

Edit `src/lib/search/enhanced.ts`:

```typescript
const SEARCH_CONFIG = {
  MIN_RESULTS_GUARANTEE: 10,  // Always return at least 10 results
  // ...
};
```

## Performance Optimization

### Database Tuning

1. **Run Migration:**
   ```bash
   npx prisma migrate deploy
   ```

2. **Refresh Materialized View** (periodically):
   ```sql
   SELECT refresh_common_search_terms();
   ```

3. **Analyze Tables** for query planner:
   ```sql
   ANALYZE jobs;
   ANALYZE job_embeddings;
   ```

### Query Performance

- **Exact matches**: ~5-10ms (indexed lookups)
- **Full-text search**: ~20-50ms (GIN index)
- **Semantic search**: ~30-100ms (HNSW index)
- **Complete search (all layers)**: ~100-300ms

## Rankings & Scoring

### Match Categories (Priority Order)

1. **Title Match** (Highest)
   - Exact: 1000 points
   - Starts with: 800 points
   - Contains: 600 points
   - All words match: 400 points

2. **Company Match**
   - Exact: 600 points
   - Contains: 400 points

3. **Location Match**
   - Exact: 450 points
   - Contains: 300 points
   - Remote keyword match: 350 points

4. **Semantic Match**
   - Cosine similarity × 1000
   - Range: 0-1000 points

5. **Fuzzy Match**
   - Trigram similarity × 800
   - Range: 0-800 points

### Score Thresholds

- **Excellent**: 1000+ (Exact matches)
- **High**: 600-999 (Strong matches)
- **Medium**: 300-599 (Good matches)
- **Low**: 100-299 (Weak matches)
- **Minimum**: 50-99 (Fallback matches)

## Fallback Behavior

The system automatically degrades search quality to ensure results:

1. Start with exact matches (highest relevance)
2. If < 10 results, add full-text matches
3. If < 10 results, add fuzzy matches + spelling suggestions
4. If < 10 results, add semantic similarity matches
5. If < 10 results, add broad token matches
6. If < 10 results, return most recent jobs (guaranteed)

**Users always see relevant results, never "No matches found".**

## Monitoring

### Search Analytics Table

Tracks all searches for improvement:
- Query text and normalized form
- Results count
- Click-through rate
- Search duration
- Filters used

Query to analyze search performance:
```sql
SELECT 
  query_normalized,
  COUNT(*) as search_count,
  AVG(results_count) as avg_results,
  AVG(search_duration_ms) as avg_duration
FROM search_analytics
GROUP BY query_normalized
ORDER BY search_count DESC
LIMIT 100;
```

## Testing

### Test Search Quality

```bash
# Test exact match
curl -X POST http://localhost:3000/api/search/jobs \
  -H "Content-Type: application/json" \
  -d '{"query": "Software Engineer"}'

# Test with typo (fuzzy)
curl -X POST http://localhost:3000/api/search/jobs \
  -H "Content-Type: application/json" \
  -d '{"query": "sofware enginer"}'

# Test semantic (different keywords)
curl -X POST http://localhost:3000/api/search/jobs \
  -H "Content-Type: application/json" \
  -d '{"query": "coding job"}'
```

### Test Suggestions

```bash
# Test autocomplete
curl "http://localhost:3000/api/search/suggestions?query=soft&limit=5"

# Test empty query (fallback)
curl "http://localhost:3000/api/search/suggestions?query="
```

## Migration Guide

### From Legacy Search

1. **Update imports:**
   ```typescript
   // Before
   import { searchJobs } from '@/lib/search';
   
   // After
   import { searchJobsEnhanced } from '@/lib/search/enhanced';
   ```

2. **API is identical** - just swap the function

3. **Response includes new fields:**
   - `layersUsed`: Which search layers were activated
   - `totalCandidates`: Total candidates before ranking
   - `fallbackUsed`: Whether fallback was needed

## Troubleshooting

### No Results
- Check PostgreSQL extensions: `pg_trgm`, `vector`
- Verify indexes exist: `\di idx_jobs_*`
- Check job_embeddings table has data

### Slow Queries
- Run `ANALYZE` on tables
- Check index usage: `EXPLAIN (ANALYZE, BUFFERS) ...`
- Consider increasing HNSW ef_construction parameter

### Poor Relevance
- Adjust weights in `DEFAULT_WEIGHTS`
- Check tokenization: `normalizeText()` function
- Verify embeddings are up-to-date

## Future Enhancements

### ✅ Implemented

- [x] **Query expansion with synonyms** - Comprehensive synonym mapping in `src/lib/search/synonyms.ts` supporting:
  - Job title abbreviations (swe → software engineer, pm → product manager)
  - Experience levels (jr → junior, sr → senior, new grad → entry level)
  - Technology keywords (frontend → front-end, devops → sre)
  - Location variations (sf → san francisco, remote → work from home)

### 🔮 Planned

- [ ] **Personalization based on user history**
  - Track search history in localStorage (already available via `HISTORY_KEY`)
  - Boost results matching previously clicked job titles
  - Store user preferences for job types and locations
  - Implementation: Add user_search_history table, modify scoring to include personalization factor

- [ ] **A/B testing for ranking algorithms**
  - Create experiment framework for comparing ranking strategies
  - Track metrics: click-through rate, time on page, save rate
  - Implementation: Add experiment_config table, modify search response to include variant ID

- [ ] **Learning to rank (LTR) with click feedback**
  - Collect click data with position and dwell time
  - Train lightweight ranking model on click patterns
  - Implementation: Add search_clicks table, integrate with ML pipeline

- [ ] **Multi-language support**
  - Detect query language using character patterns
  - Index job descriptions in original language + English translation
  - Support for major languages: Spanish, French, German, Mandarin
  - Implementation: Add language_detected column, use PostgreSQL text search configurations per language

