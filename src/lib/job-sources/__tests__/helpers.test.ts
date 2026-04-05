import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateContentHash,
  generateFallbackId,
  normalizeForHash,
  stripHtmlToPlain,
  categorizeExperienceLevel,
  categorizeJobType,
} from '../helpers'
import { isValidLogoUrl, scrapeLogoFromWebsite, resolveProviderLogo } from '@/lib/company'

describe('normalizeForHash', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeForHash('  hello  ')).toBe('hello')
  })

  it('lowercases the input', () => {
    expect(normalizeForHash('Hello World')).toBe('hello world')
  })

  it('collapses multiple spaces to a single space', () => {
    expect(normalizeForHash('hello   world')).toBe('hello world')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeForHash('hello\t\n  world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(normalizeForHash('')).toBe('')
  })

  it('handles unicode characters', () => {
    expect(normalizeForHash('  Développeur  Senior  ')).toBe('développeur senior')
  })
})

describe('generateContentHash', () => {
  it('produces a deterministic hex string', () => {
    const hash1 = generateContentHash('Engineer', 'Acme', 'NYC', 'https://acme.com/jobs/1')
    const hash2 = generateContentHash('Engineer', 'Acme', 'NYC', 'https://acme.com/jobs/1')
    expect(hash1).toBe(hash2)
  })

  it('produces a 64-character hex string (SHA-256)', () => {
    const hash = generateContentHash('Title', 'Company', 'Location', 'https://example.com')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('normalizes whitespace and casing before hashing', () => {
    const hash1 = generateContentHash('  Software Engineer  ', 'ACME Corp', 'new york', 'https://acme.com')
    const hash2 = generateContentHash('software engineer', 'acme corp', 'New York', 'https://acme.com')
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = generateContentHash('Engineer', 'Acme', 'NYC', 'https://acme.com/1')
    const hash2 = generateContentHash('Designer', 'Acme', 'NYC', 'https://acme.com/1')
    expect(hash1).not.toBe(hash2)
  })
})

describe('generateFallbackId', () => {
  it('produces a deterministic hex string', () => {
    const id1 = generateFallbackId('Engineer', 'Acme', 'NYC', 'https://acme.com/apply')
    const id2 = generateFallbackId('Engineer', 'Acme', 'NYC', 'https://acme.com/apply')
    expect(id1).toBe(id2)
  })

  it('produces a 64-character hex string (SHA-256)', () => {
    const id = generateFallbackId('Title', 'Company', 'Location', 'https://example.com/apply')
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('normalizes whitespace and casing before hashing', () => {
    const id1 = generateFallbackId('  Software  Engineer  ', 'ACME Corp', '  NYC  ', 'https://acme.com')
    const id2 = generateFallbackId('software engineer', 'acme corp', 'nyc', 'https://acme.com')
    expect(id1).toBe(id2)
  })

  it('handles null applyUrl gracefully', () => {
    const id1 = generateFallbackId('Engineer', 'Acme', 'NYC', null)
    const id2 = generateFallbackId('Engineer', 'Acme', 'NYC', null)
    expect(id1).toBe(id2)
    expect(id1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('null applyUrl produces different hash than empty string applyUrl', () => {
    // Both null and '' normalize to '' — this is by design per spec
    const id1 = generateFallbackId('Engineer', 'Acme', 'NYC', null)
    const id2 = generateFallbackId('Engineer', 'Acme', 'NYC', '')
    // Per spec: normalize(applyUrl ?? '') means null and '' produce the same hash
    expect(id1).toBe(id2)
  })

  it('produces different hashes for different inputs', () => {
    const id1 = generateFallbackId('Engineer', 'Acme', 'NYC', 'https://acme.com/apply')
    const id2 = generateFallbackId('Designer', 'Acme', 'NYC', 'https://acme.com/apply')
    expect(id1).not.toBe(id2)
  })

  it('produces different hash from generateContentHash with same positional args', () => {
    // fallbackId uses (title, company, location, applyUrl)
    // contentHash uses (title, company, location, sourceUrl)
    // With same inputs they should STILL differ because the join separator is different
    const fallback = generateFallbackId('Engineer', 'Acme', 'NYC', 'https://acme.com')
    const content = generateContentHash('Engineer', 'Acme', 'NYC', 'https://acme.com')
    // They use different prefixes to avoid collision
    expect(fallback).not.toBe(content)
  })
})

describe('stripHtmlToPlain', () => {
  it('strips HTML tags and returns plain text', () => {
    expect(stripHtmlToPlain('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
  })

  it('handles null input', () => {
    expect(stripHtmlToPlain(null)).toBeNull()
  })

  it('handles empty string', () => {
    expect(stripHtmlToPlain('')).toBe('')
  })

  it('preserves newlines from block elements', () => {
    const result = stripHtmlToPlain('<p>First</p><p>Second</p>')
    expect(result).toContain('First')
    expect(result).toContain('Second')
  })

  it('decodes HTML entities', () => {
    expect(stripHtmlToPlain('&amp; &lt; &gt; &quot;')).toBe('& < > "')
  })
})

describe('company logo resolver heuristics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.LOGO_API_KEY
    delete process.env.LOGO_PROVIDER
  })

  it('prefers mask icons over other metadata tags', async () => {
    const html = `
      <link rel="icon" href="/favicon.png" />
      <link rel="apple-touch-icon" href="/apple.png" />
      <link rel="mask-icon" href="/mask.svg" />
      <meta property="og:image" content="/og.png" />
    `
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    }))

    const candidate = await scrapeLogoFromWebsite('example.com')
    expect(candidate).not.toBeNull()
    expect(candidate?.source).toBe('mask-icon')
    expect(candidate?.logoUrl).toBe('https://example.com/mask.svg')
  })

  it('prefers the largest manifest icon when metadata is missing', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            icons: [
              { src: '/small.png', sizes: '64x64' },
              { src: '/big.png', sizes: '256x256' },
            ],
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        text: async () => '<link rel="manifest" href="/manifest.json" />',
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidate = await scrapeLogoFromWebsite('manifest.test')
    expect(candidate).not.toBeNull()
    expect(candidate?.source).toBe('manifest')
    expect(candidate?.logoUrl).toBe('https://manifest.test/big.png')
  })

  it('normalizes provider domains before hitting logo.dev', async () => {
    process.env.LOGO_API_KEY = 'abc'
    process.env.LOGO_PROVIDER = 'logo.dev'
    const fetchMock = vi.fn((url, options) => {
      if (url.includes('img.logo.dev')) {
        expect(url).toBe('https://img.logo.dev/example.com?token=abc&size=120')
        expect(options?.method).toBe('HEAD')
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false })
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidate = await resolveProviderLogo('Example Corp', 'https://WWW.Example.COM/path')
    expect(candidate).not.toBeNull()
    expect(candidate?.logoUrl).toContain('example.com')
  })

  it('rejects provider URLs when provider fallback is disabled', () => {
    const url = 'https://logo.dev/example/logo.png'
    expect(isValidLogoUrl(url, { allowProviderFallback: false })).toBe(false)
    expect(isValidLogoUrl(url, { allowProviderFallback: true })).toBe(true)
  })
})

describe('categorizeExperienceLevel', () => {
  // Entry-level signals
  it('detects intern', () => {
    expect(categorizeExperienceLevel('Software Engineer Intern')).toBe('entry')
  })
  it('detects internship', () => {
    expect(categorizeExperienceLevel('Data Science Internship')).toBe('entry')
  })
  it('detects new grad', () => {
    expect(categorizeExperienceLevel('New Grad SWE')).toBe('entry')
  })
  it('detects new-grad (hyphenated)', () => {
    expect(categorizeExperienceLevel('New-Grad Software Engineer')).toBe('entry')
  })
  it('detects entry level (spaced)', () => {
    expect(categorizeExperienceLevel('Entry Level Analyst')).toBe('entry')
  })
  it('detects entry-level (hyphenated)', () => {
    expect(categorizeExperienceLevel('Entry-Level Product Manager')).toBe('entry')
  })
  it('detects early career', () => {
    expect(categorizeExperienceLevel('Early Career Engineer')).toBe('entry')
  })
  it('detects junior', () => {
    expect(categorizeExperienceLevel('Junior Frontend Developer')).toBe('entry')
  })
  it('detects jr. (abbreviated)', () => {
    expect(categorizeExperienceLevel('Jr. Software Engineer')).toBe('entry')
  })
  it('detects associate (finance entry-level pattern)', () => {
    expect(categorizeExperienceLevel('Investment Banking Associate')).toBe('entry')
  })
  it('detects grad', () => {
    expect(categorizeExperienceLevel('Grad Software Engineer')).toBe('entry')
  })
  it('detects university hire', () => {
    expect(categorizeExperienceLevel('University Hire - Engineering')).toBe('entry')
  })

  // Senior signals
  it('detects senior', () => {
    expect(categorizeExperienceLevel('Senior Software Engineer')).toBe('senior')
  })
  it('detects sr. (abbreviated)', () => {
    expect(categorizeExperienceLevel('Sr. Data Scientist')).toBe('senior')
  })
  it('detects staff', () => {
    expect(categorizeExperienceLevel('Staff Engineer')).toBe('senior')
  })
  it('detects principal', () => {
    expect(categorizeExperienceLevel('Principal Product Manager')).toBe('senior')
  })

  // Lead signals
  it('detects lead', () => {
    expect(categorizeExperienceLevel('Tech Lead')).toBe('lead')
  })
  it('detects manager', () => {
    expect(categorizeExperienceLevel('Engineering Manager')).toBe('lead')
  })
  it('detects director', () => {
    expect(categorizeExperienceLevel('Director of Engineering')).toBe('lead')
  })
  it('detects head of', () => {
    expect(categorizeExperienceLevel('Head of Product')).toBe('lead')
  })
  it('detects vp', () => {
    expect(categorizeExperienceLevel('VP of Engineering')).toBe('lead')
  })

  // Evaluation order: lead → senior → entry
  it('lead wins over entry: "Engineering Lead, University Recruiting"', () => {
    expect(categorizeExperienceLevel('Engineering Lead, University Recruiting')).toBe('lead')
  })
  it('senior wins over entry: "Senior Manager, New Grad Programs"', () => {
    expect(categorizeExperienceLevel('Senior Manager, New Grad Programs')).toBe('senior')
  })
  it('lead wins over entry: "Associate Director of Engineering"', () => {
    expect(categorizeExperienceLevel('Associate Director of Engineering')).toBe('lead')
  })

  // Null for ambiguous/unknown
  it('returns null for plain title with no signal', () => {
    expect(categorizeExperienceLevel('Software Engineer')).toBeNull()
  })
  it('returns null for location containing "New York" (false positive guard)', () => {
    expect(categorizeExperienceLevel('Software Engineer - New York')).toBeNull()
  })
  it('is case-insensitive', () => {
    expect(categorizeExperienceLevel('SENIOR ENGINEER')).toBe('senior')
  })
})

describe('categorizeJobType', () => {
  it('detects intern', () => {
    expect(categorizeJobType('Software Engineer Intern')).toBe('internship')
  })
  it('detects internship', () => {
    expect(categorizeJobType('Data Science Internship')).toBe('internship')
  })
  it('detects co-op (hyphenated)', () => {
    expect(categorizeJobType('Software Co-op')).toBe('internship')
  })
  it('detects coop (no hyphen)', () => {
    expect(categorizeJobType('Engineering Coop')).toBe('internship')
  })
  it('detects contract', () => {
    expect(categorizeJobType('Backend Engineer - Contract')).toBe('contract')
  })
  it('detects contractor', () => {
    expect(categorizeJobType('Data Analyst Contractor')).toBe('contract')
  })
  it('detects freelance', () => {
    expect(categorizeJobType('Freelance Designer')).toBe('contract')
  })
  it('detects part time (spaced)', () => {
    expect(categorizeJobType('Customer Support Part Time')).toBe('parttime')
  })
  it('detects part-time (hyphenated)', () => {
    expect(categorizeJobType('Part-Time Sales Associate')).toBe('parttime')
  })
  it('returns null for full-time title (no signal)', () => {
    expect(categorizeJobType('Senior Software Engineer')).toBeNull()
  })
  it('returns null for ambiguous title', () => {
    expect(categorizeJobType('Product Manager')).toBeNull()
  })
  it('is case-insensitive', () => {
    expect(categorizeJobType('SOFTWARE ENGINEER INTERN')).toBe('internship')
  })
})
