import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from '../tourSteps';

describe('TOUR_STEPS', () => {
  it('has exactly 8 steps', () => {
    expect(TOUR_STEPS).toHaveLength(8);
  });

  it('each step has required fields', () => {
    for (const step of TOUR_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.dataId).toBeTruthy();
      expect(step.text).toBeTruthy();
      expect(['left', 'right']).toContain(step.aladdinSide);
    }
  });

  it('all dataId values are unique', () => {
    const ids = TOUR_STEPS.map((s) => s.dataId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('step 1 targets the search nav item', () => {
    expect(TOUR_STEPS[0].dataId).toBe('tour-search');
  });

  it('step 8 targets the practice tab', () => {
    expect(TOUR_STEPS[7].dataId).toBe('tour-practice-tab');
  });
});
