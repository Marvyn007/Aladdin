# Contact Search & Enrichment — Backend Design

**Date:** 2026-04-16
**Status:** Approved

---

## Overview

Add a Contact Search & Enrichment feature to Aladdin. Users provide a company domain, job function, seniority level, and country to find employees. Names and titles are free (Search phase). Email addresses are fetched on demand (Reveal phase) using Apollo.io's Enrichment API.

A platform-wide database cache prevents duplicate Apollo API calls: once a contact's email is revealed, it is stored permanently and served to all future users at no additional Apollo cost. Search result lists are cached for 7 days.

---

## Tech Stack (existing — no changes)

| Concern | Technology |
|---|---|
| Framework | Next.js 16 App Router, TypeScript |
| Auth | Clerk (`@clerk/nextjs`) |
| ORM | Prisma 5 |
| Database | PostgreSQL (Neon) |
| HTTP client | Axios |
| Background jobs | Inngest (not used for this feature yet) |

---

## Architecture

Approach A — flat lib files, matching the existing `auto-apply` pattern.

```
prisma/schema.prisma                        ← 3 new models
src/lib/contacts/
  apollo-client.ts                          ← Apollo REST wrapper
  query-hash.ts                             ← SHA-256 search key util
  search-contacts.ts                        ← cache-first search logic
  reveal-contact.ts                         ← cache-first reveal logic
src/app/api/contacts/
  search/route.ts                           ← POST /api/contacts/search
  [id]/reveal/route.ts                      ← POST /api/contacts/[id]/reveal
.env.local                                  ← APOLLO_API_KEY
```

No new dependencies. `crypto` (Node built-in) is used for hashing. `axios` is already in the project.

---

## Database Schema

### `Contact`

Stores every person returned from Apollo, regardless of whether their email has been revealed.

```prisma
model Contact {
  id               String    @id @default(uuid()) @db.Uuid
  apolloId         String    @unique @map("apollo_id")
  firstName        String?   @map("first_name")
  lastName         String?   @map("last_name")
  title            String?
  companyName      String?   @map("company_name")
  companyDomain    String?   @map("company_domain")
  linkedinUrl      String?   @map("linkedin_url")
  location         String?
  email            String?                          // null until revealed
  emailStatus      String?   @map("email_status")  // Apollo verification status
  emailRevealedAt  DateTime? @map("email_revealed_at") @db.Timestamptz(6)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  reveals ContactReveal[]

  @@index([companyDomain], map: "idx_contacts_company_domain")
  @@map("contacts")
}
```

### `ContactSearchCache`

Caches a page of search results keyed by a SHA-256 hash of the search parameters. Expires after 7 days.

```prisma
model ContactSearchCache {
  id               String   @id @default(uuid()) @db.Uuid
  queryHash        String   @unique @map("query_hash")
  companyDomain    String   @map("company_domain")
  jobFunction      String?  @map("job_function")
  managementLevel  String?  @map("management_level")
  country          String?
  page             Int      @default(1)
  totalEntries     Int?     @map("total_entries")
  contactApolloIds Json     @map("contact_apollo_ids")  // string[]
  expiresAt        DateTime @map("expires_at") @db.Timestamptz(6)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([queryHash, expiresAt], map: "idx_contact_search_cache_hash_expires")
  @@map("contact_search_cache")
}
```

### `ContactReveal`

One row per user per revealed contact. Foundation for future subscription quota enforcement.

```prisma
model ContactReveal {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id")
  contactId  String   @map("contact_id") @db.Uuid
  revealedAt DateTime @default(now()) @map("revealed_at") @db.Timestamptz(6)

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([userId, contactId], map: "uniq_contact_reveal_user_contact")
  @@index([userId], map: "idx_contact_reveals_user_id")
  @@map("contact_reveals")
}
```

---

## Apollo.io Integration

### Authentication

All requests use the `X-Api-Key` header. The key is never passed in the request body.

```
X-Api-Key: <APOLLO_API_KEY>
Content-Type: application/json
```

### Search API — `POST /api/v1/mixed_people/search`

Maps Aladdin search parameters to Apollo fields:

| Aladdin param | Apollo field |
|---|---|
| `companyDomain` | `q_organization_domains_list` (array) |
| `jobFunction` | `person_titles` (array) |
| `managementLevel` | `person_seniorities` (array) |
| `country` | `person_locations` (array) |
| `page` | `page` |
| — | `per_page: 25` |

Response fields used: `people[].id` (→ `apolloId`), `people[].first_name`, `people[].last_name`, `people[].title`, `people[].organization.name`, `people[].organization.primary_domain`, `people[].linkedin_url`, `people[].city`, `total_entries`.

**Emails are NOT requested during search.** `reveal_personal_emails` is never set on this call.

### Enrichment API — `POST /api/v1/people/match`

Called only when the user explicitly requests a reveal and the email is not already cached.

```json
{
  "id": "<apollo_person_id>",
  "reveal_personal_emails": true
}
```

Response fields used: `person.email`, `person.email_status`.

---

## Logic Flows

### `searchContacts(params, userId)`

```
1. queryHash = sha256(`${companyDomain}|${jobFunction}|${managementLevel}|${country}|${page}`)
2. cache = ContactSearchCache WHERE queryHash = queryHash AND expiresAt > now()
3. if cache HIT:
     contacts = Contact WHERE apolloId IN cache.contactApolloIds
     return { contacts, totalEntries: cache.totalEntries, cached: true }
4. if cache MISS:
     result = apolloClient.searchPeople(params)
     for each person in result.people:
       upsert Contact on apolloId conflict (update name/title/company fields, never touch email)
     write ContactSearchCache { queryHash, contactApolloIds, totalEntries, expiresAt: now+7d }
     return { contacts, totalEntries: result.total_entries, cached: false }
```

### `revealContactEmail(contactId, userId)`

```
1. contact = Contact WHERE id = contactId  (404 if missing)
2. if contact.email IS NOT NULL:
     upsert ContactReveal (userId, contactId)
     return { email, emailStatus, fromCache: true }
3. person = apolloClient.enrichPerson(contact.apolloId)
4. update Contact SET email, emailStatus, emailRevealedAt = now()
5. upsert ContactReveal (userId, contactId)
6. return { email, emailStatus, fromCache: false }
```

---

## API Routes

### `POST /api/contacts/search`

**Auth:** Clerk `auth()` — returns 401 if unauthenticated.

**Request body:**
```json
{
  "companyDomain": "stripe.com",
  "jobFunction": "engineering",
  "managementLevel": "senior",
  "country": "US",
  "page": 1
}
```

**Response 200:**
```json
{
  "contacts": [
    {
      "id": "<uuid>",
      "firstName": "Jane",
      "lastName": "Doe",
      "title": "Senior Engineer",
      "companyName": "Stripe",
      "companyDomain": "stripe.com",
      "linkedinUrl": "https://linkedin.com/in/janedoe",
      "emailRevealed": false
    }
  ],
  "totalEntries": 142,
  "page": 1,
  "cached": true
}
```

### `POST /api/contacts/[id]/reveal`

**Auth:** Clerk `auth()` — returns 401 if unauthenticated.

**Response 200:**
```json
{
  "email": "jane@stripe.com",
  "emailStatus": "verified",
  "fromCache": false
}
```

---

## Error Handling

| Apollo status | Error class | HTTP response to client |
|---|---|---|
| 401 | `ApolloAuthError` | 500 (server misconfiguration) |
| 429 | `ApolloRateLimitError` | 429 |
| 404 (enrich) | `ApolloNotFoundError` | 404 |
| Network / 5xx | `ApolloServiceError` | 502 |

All error classes are thrown by `apollo-client.ts` and caught in route handlers.

---

## Environment Variables

Add to `.env.local`:

```
# Apollo.io — platform-wide key, developer pays
APOLLO_API_KEY=your_apollo_api_key_here
```

Read exclusively inside `src/lib/contacts/apollo-client.ts`.

---

## Future Considerations (out of scope for this phase)

- **Stripe subscription tiers:** Use `ContactReveal` count per user per billing period to enforce monthly quotas.
- **Inngest async reveals:** Move Apollo enrichment calls into an Inngest function with retries and concurrency limits when under real credit pressure.
- **Apollo rate limit backoff:** Implement exponential retry in `apollo-client.ts` when 429s are frequent.
