import { describe, it, expect } from 'vitest'
import { computePreferenceScore, isHardRejected } from '@/lib/preference-scoring'
import type { Job } from '@/types'
import type { OnboardingAnswerRecord } from '@/lib/onboarding'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'San Francisco, CA',
    source_url: 'https://example.com',
    posted_at: null,
    fetched_at: new Date().toISOString(),
    status: 'fresh',
    normalized_text: null,
    raw_text_summary: null,
    content_hash: null,
    job_description_plain: 'We are building REST APIs with Python and Django. Experience with PostgreSQL and Docker required.',
    skills: ['Python', 'Django', 'REST', 'PostgreSQL', 'Docker'],
    jobType: 'fulltime',
    isRemote: false,
    ...overrides,
  }
}

function makeAnswer(
  key: string,
  value: unknown,
  type: OnboardingAnswerRecord['type'] = 'multi_select'
): OnboardingAnswerRecord {
  return {
    questionKey: key,
    step: 1,
    order: 1,
    type,
    title: key,
    value,
    answerText: null,
  }
}

describe('computePreferenceScore', () => {
  it('scores 0 for empty answers', () => {
    const job = makeJob()
    expect(computePreferenceScore(job, {})).toBe(0)
  })

  it('exact role title in job title gives 15pts for job_function', () => {
    const job = makeJob({ title: 'Backend Engineer' })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: ['Backend Engineer'],
      }, 'job_function'),
    }
    const score = computePreferenceScore(job, answers)
    expect(score).toBeGreaterThanOrEqual(15)
  })

  it('role in description (not title) gives 8pts exact taxonomy', () => {
    const job = makeJob({
      title: 'Software Engineer',
      job_description_plain: 'Looking for a Python Engineer to join our team.',
    })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: ['Python Engineer'],
      }, 'job_function'),
    }
    const score = computePreferenceScore(job, answers)
    expect(score).toBeGreaterThanOrEqual(8)
  })

  it('keyword expansion gives 5–10pts for description hits', () => {
    const job = makeJob({
      title: 'Software Engineer',
      job_description_plain: 'We use REST, API, Python and microservices extensively.',
      skills: ['Python', 'REST'],
    })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: [],
      }, 'job_function'),
    }
    const score = computePreferenceScore(job, answers)
    expect(score).toBeGreaterThan(0)
  })

  it('skills overlap gives pts when job.skills match role implied skills', () => {
    const job = makeJob({
      title: 'Engineer',
      job_description_plain: '',
      skills: ['Python', 'Django', 'FastAPI'],
    })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: ['Python Engineer'],
      }, 'job_function'),
    }
    const score = computePreferenceScore(job, answers)
    expect(score).toBeGreaterThan(0)
  })

  it('seniority penalty: early_career + Senior title = -8 within job_function block', () => {
    const jobNoSenior = makeJob({ title: 'Backend Engineer', job_description_plain: 'Python developer role.' })
    const jobSenior = makeJob({ title: 'Senior Backend Engineer', job_description_plain: 'Python developer role.' })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: ['Backend Engineer'],
      }, 'job_function'),
      career_levels: makeAnswer('career_levels', ['early_career']),
    }
    const scoreNoSenior = computePreferenceScore(jobNoSenior, answers)
    const scoreSenior = computePreferenceScore(jobSenior, answers)
    expect(scoreNoSenior).toBeGreaterThan(scoreSenior)
  })

  it('regions gives 25pts for matching location', () => {
    const job = makeJob({ location: 'united states' })
    const answers = {
      regions: makeAnswer('regions', ['united_states']),
    }
    expect(computePreferenceScore(job, answers)).toBe(25)
  })

  it('role_types gives 20pts for matching jobType', () => {
    const job = makeJob({ jobType: 'fulltime' })
    const answers = {
      role_types: makeAnswer('role_types', ['full_time']),
    }
    expect(computePreferenceScore(job, answers)).toBe(20)
  })

  it('work_style gives 15pts for remote job + remote preference', () => {
    const job = makeJob({ isRemote: true })
    const answers = {
      work_style: makeAnswer('work_style', 'remote', 'single_select'),
    }
    expect(computePreferenceScore(job, answers)).toBe(15)
  })

  it('career_levels gives 10pts for matching seniority keyword', () => {
    const job = makeJob({ title: 'Senior Software Engineer' })
    const answers = {
      career_levels: makeAnswer('career_levels', ['senior_manager']),
    }
    expect(computePreferenceScore(job, answers)).toBe(10)
  })

  it('total score is clamped to 100', () => {
    const job = makeJob({
      title: 'Backend Engineer',
      location: 'united states',
      jobType: 'fulltime',
      isRemote: false,
      skills: ['Python', 'Django'],
      job_description_plain: 'Python REST API microservices Docker PostgreSQL.',
    })
    const answers = {
      job_function: makeAnswer('job_function', {
        industries: ['Software/Internet/AI'],
        subcategories: ['Backend Engineering'],
        roles: ['Backend Engineer', 'Python Engineer'],
      }, 'job_function'),
      regions: makeAnswer('regions', ['united_states']),
      role_types: makeAnswer('role_types', ['full_time']),
      work_style: makeAnswer('work_style', 'onsite', 'single_select'),
      career_levels: makeAnswer('career_levels', ['mid_level']),
    }
    const score = computePreferenceScore(job, answers)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThan(50)
  })
})

describe('isHardRejected', () => {
  it('returns false when role_types answer is missing', () => {
    const job = makeJob({ jobType: 'fulltime' })
    expect(isHardRejected(job, {})).toBe(false)
  })

  it('returns false when job.jobType is null', () => {
    const job = makeJob({ jobType: null })
    const answers = { role_types: makeAnswer('role_types', ['full_time']) }
    expect(isHardRejected(job, answers)).toBe(false)
  })

  it('returns false when employment type matches', () => {
    const job = makeJob({ jobType: 'fulltime' })
    const answers = { role_types: makeAnswer('role_types', ['full_time']) }
    expect(isHardRejected(job, answers)).toBe(false)
  })

  it('returns true when employment type has zero overlap', () => {
    const job = makeJob({ jobType: 'fulltime' })
    const answers = { role_types: makeAnswer('role_types', ['internship']) }
    expect(isHardRejected(job, answers)).toBe(true)
  })
})
