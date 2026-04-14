import { describe, it, expect } from 'vitest'
import { JOB_FUNCTION_TAXONOMY, ONBOARDING_QUESTIONS } from '@/lib/onboarding'

describe('JOB_FUNCTION_TAXONOMY', () => {
  it('has 19 industries', () => {
    expect(JOB_FUNCTION_TAXONOMY).toHaveLength(19)
  })

  it('every industry has a label and at least one subcategory', () => {
    for (const industry of JOB_FUNCTION_TAXONOMY) {
      expect(typeof industry.industry).toBe('string')
      expect(industry.subcategories.length).toBeGreaterThan(0)
    }
  })

  it('every subcategory has a label and at least one role', () => {
    for (const industry of JOB_FUNCTION_TAXONOMY) {
      for (const sub of industry.subcategories) {
        expect(typeof sub.label).toBe('string')
        expect(sub.roles.length).toBeGreaterThan(0)
      }
    }
  })

  it('work_areas question is gone', () => {
    const keys = ONBOARDING_QUESTIONS.map(q => q.key)
    expect(keys).not.toContain('work_areas')
  })

  it('job_function question exists in step 1', () => {
    const q = ONBOARDING_QUESTIONS.find(q => q.key === 'job_function')
    expect(q).toBeDefined()
    expect(q!.step).toBe(1)
    expect(q!.type).toBe('job_function')
  })
})
