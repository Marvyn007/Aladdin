# Referrals Page — Client-Side Filtering Redesign

## Goal

Replace the pre-search filter model (which sends filters to Prospeo and causes 502s when no one matches) with a fetch-everything-then-filter-client-side model. Single search input, dynamic filter chips built from real results, no API errors visible to users.

## Architecture

### Backend changes

**`search-contacts.ts`**
- Accept only `companyDomain` and an optional `limit` (default 75).
- Remove `jobFunction`, `managementLevel`, `country` from the Prospeo request body entirely.
- Fetch up to 3 pages (25 each) from Prospeo sequentially. Stop early if a page returns fewer than 25 results.
- Merge all pages into one flat list before upserting to DB.
- Cache key = `sha256(companyDomain)` — ignores filters/page since we now fetch all at once.
- On any Prospeo error mid-fetch: log the error, return whatever contacts were collected so far (may be empty list). Never throw a 502.

**`query-hash.ts` / `SearchParams`**
- Remove `jobFunction`, `managementLevel`, `country`, `page` from `SearchParams`.
- New shape: `{ companyDomain: string }`.

**`/api/contacts/search` route**
- Accept only `{ companyDomain }` in the request body.
- Return `{ contacts: ContactSearchResult[], totalEntries: number, cached: boolean }`.

**`prospeo-client.ts` → `searchPeople()`**
- Remove filter params for seniority, job title, country.
- Only send `filters.company.websites.include: [domain]`.
- Keep `page` param for the multi-page fetch loop.

**DB: no schema changes required.** Existing `contact` table already stores `location` (city) and all needed fields. `contactSearchCache` stores by `queryHash` which will now be domain-only.

### Frontend changes

**`ReferralsView.tsx`** — full rewrite of state and layout:

**Search form:**
- Single `<input>` for company name or URL.
- "Search" button triggers the API call.
- Domain extraction logic stays (handles `"zerodha"`, `"zerodha.com"`, `"https://zerodha.com"`).

**After results load — filter panel:**
- Rendered only when `results.contacts.length > 0`.
- Three filter groups: **Seniority**, **Country**, **City** — derived from the returned contacts.
- Each option shows a count badge: `Senior (12)`, `India (9)`.
- Seniority is parsed from `current_job_title` using a keyword list (Senior, Manager, Director, VP, C-Suite, Entry — case-insensitive).
- Options with zero matches in the current filter state are hidden.
- Multiple filters can be active simultaneously (AND logic across groups, OR within a group).
- "Clear filters" link resets all selections.

**Table columns (updated):**

| Column | Source field | Notes |
|---|---|---|
| Person | `firstName + lastName` | Avatar with initials |
| Title | `title` (current_job_title) | |
| Headline | `headline` | New column; hidden if all null |
| Location | `location.city + location.country` | New column; city, Country |
| LinkedIn | `linkedinUrl` | Link button |
| Email | `email` | Blurred until revealed |
| Action | Reveal button | Unchanged |

**Empty states:**
- No results from API → "No contacts found for this company." (no error shown)
- Results exist but active filters match nothing → "No contacts match the selected filters." with a "Clear filters" link.

**Removed from UI:**
- Job Function dropdown (pre-search)
- Management Level dropdown (pre-search)
- Country dropdown (pre-search)
- Page number / pagination (we now fetch all at once, up to 75)

## Data Flow

```
User types "zerodha" or "zerodha.com"
  → extractDomain() → "zerodha.com"
  → POST /api/contacts/search { companyDomain: "zerodha.com" }
  → check contactSearchCache by hash("zerodha.com")
    → cache HIT: return stored contacts
    → cache MISS:
        fetch page 1 from Prospeo (25 results)
        fetch page 2 if page 1 had 25 results
        fetch page 3 if page 2 had 25 results
        upsert all contacts to DB
        write cache entry (7-day TTL)
        return all contacts
  → frontend receives flat list (up to 75 contacts)
  → builds filter options from result data
  → user selects filters → React state filters the list in memory
  → user clicks "Reveal Email" → POST /api/contacts/{id}/reveal (unchanged)
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Prospeo 400/404/5xx mid-fetch | Stop fetching more pages, return contacts collected so far |
| Prospeo 401/403 (auth) | Return 500 with "API configuration error" |
| Prospeo 429 (rate limit) | Return 429 with "Rate limit exceeded" |
| Zero contacts returned | Return empty list; UI shows "No contacts found" |
| Filter selections match nothing | UI shows empty table with "No contacts match filters" message |

## Free-Tier Impact

- 3 API calls per unique company domain (cached 7 days).
- Each cache hit costs 0 API calls.
- Email reveals still cost 1 credit each (unchanged).
- Searching 10 different companies in a week = 30 search API calls.

## Files to Change

| File | Change type |
|---|---|
| `src/lib/contacts/query-hash.ts` | Simplify `SearchParams` to `{ companyDomain: string }` |
| `src/lib/contacts/prospeo-client.ts` | Remove filter params from `searchPeople()` |
| `src/lib/contacts/search-contacts.ts` | Multi-page fetch loop; cache by domain only |
| `src/app/api/contacts/search/route.ts` | Accept only `companyDomain` |
| `src/components/layout/ReferralsView.tsx` | Full UX rewrite with client-side filters |

No DB schema changes. No changes to reveal flow.
