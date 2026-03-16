/**
 * Unit tests for Score Jobs Pipeline
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeSkill,
  skillsMatch,
  industriesMatch,
  getCanonicalSkills,
} from '@/lib/score-jobs/skill-normalization';
import {
  determineSeniorityFromTitle,
  determineSeniorityFromExperience,
  calculateSeniorityMatch,
  calculateExperienceMatch,
  extractYearsFromDescription,
} from '@/lib/score-jobs/seniority-rules';

describe('Skill Normalization', () => {
  it('should normalize common programming languages', () => {
    expect(normalizeSkill('JavaScript')).toBe('javascript');
    expect(normalizeSkill('python')).toBe('python');
    expect(normalizeSkill('TypeScript')).toBe('typescript');
  });

  it('should normalize frameworks and tools', () => {
    expect(normalizeSkill('React.js')).toBe('react');
    expect(normalizeSkill('reactjs')).toBe('react');
    expect(normalizeSkill('Node.js')).toBe('node.js');
    expect(normalizeSkill('Postgres')).toBe('postgresql');
  });

  it('should handle variations and synonyms', () => {
    expect(normalizeSkill('JS')).toBe('javascript');
    expect(normalizeSkill('py')).toBe('python');
    expect(normalizeSkill('Django-REST-framework')).toBe('django');
  });

  it('should get canonical skills from array', () => {
    const skills = ['JavaScript', 'Python', 'React', 'AWS', 'docker'];
    const canonical = getCanonicalSkills(skills);
    expect(canonical).toContain('javascript');
    expect(canonical).toContain('python');
    expect(canonical).toContain('react');
    expect(canonical).toContain('aws');
    expect(canonical).toContain('docker');
  });
});

describe('Skills Matching', () => {
  it('should match exact skills', () => {
    const result = skillsMatch('python', 'python', 0.9);
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it('should match case-insensitively', () => {
    const result = skillsMatch('PYTHON', 'Python', 0.9);
    expect(result.isMatch).toBe(true);
  });

  it('should not match unrelated skills', () => {
    const result = skillsMatch('python', 'java', 0.9);
    expect(result.isMatch).toBe(false);
  });

  it('should require higher confidence for fuzzy matches', () => {
    // Low confidence LLM result should require embedding fallback
    const result = skillsMatch('javascript', 'js', 0.5);
    expect(result.isMatch).toBe(false);
  });
});

describe('Industry Matching', () => {
  it('should match exact industries', () => {
    const result = industriesMatch('software', ['software']);
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(1.0);
  });

  it('should match related industries with partial score', () => {
    const result = industriesMatch('software', ['technology']);
    expect(result.isMatch).toBe(true);
    expect(result.score).toBe(0.6);
  });

  it('should not match unrelated industries', () => {
    const result = industriesMatch('healthcare', ['software']);
    expect(result.isMatch).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should handle null inputs', () => {
    const result = industriesMatch(null, ['software']);
    expect(result.isMatch).toBe(false);
  });
});

describe('Seniority Rules', () => {
  it('should determine seniority from job title - intern', () => {
    const result = determineSeniorityFromTitle('Software Engineering Intern', null, 0);
    expect(result.seniority).toBe('intern');
    expect(result.confidence).toBe(0.95);
  });

  it('should determine seniority from job title - senior', () => {
    const result = determineSeniorityFromTitle('Senior Software Engineer', null, 0);
    expect(result.seniority).toBe('senior');
    expect(result.confidence).toBe(0.95);
  });

  it('should determine seniority from job title - lead', () => {
    const result = determineSeniorityFromTitle('Tech Lead', null, 0);
    expect(result.seniority).toBe('lead');
    expect(result.confidence).toBe(0.95);
  });

  it('should use LLM extraction when confident', () => {
    const result = determineSeniorityFromTitle('Engineer', 'senior', 0.9);
    expect(result.seniority).toBe('senior');
  });

  it('should fallback to rules when LLM confidence is low', () => {
    const result = determineSeniorityFromTitle('Software Engineer', 'mid', 0.5);
    // Should fallback to rules because confidence < 0.8
    expect(result.confidence).toBe(0.7); // From deterministic rules
  });
});

describe('Seniority from Experience', () => {
  it('should map intern level', () => {
    const result = determineSeniorityFromExperience(1);
    expect(result.seniority).toBe('intern');
  });

  it('should map junior level', () => {
    const result = determineSeniorityFromExperience(2);
    expect(result.seniority).toBe('junior');
  });

  it('should map mid level', () => {
    const result = determineSeniorityFromExperience(4);
    expect(result.seniority).toBe('mid');
  });

  it('should map senior level', () => {
    const result = determineSeniorityFromExperience(7);
    expect(result.seniority).toBe('senior');
  });

  it('should handle null experience', () => {
    const result = determineSeniorityFromExperience(null);
    expect(result.confidence).toBeLessThan(1);
  });
});

describe('Seniority Match', () => {
  it('should score exact match as 1.0', () => {
    const result = calculateSeniorityMatch('senior', 'senior', 7, 0.9);
    expect(result.score).toBe(1.0);
    expect(result.isMatch).toBe(true);
  });

  it('should score adjacent levels with 0.7', () => {
    const result = calculateSeniorityMatch('mid', 'senior', 5, 0.9);
    expect(result.score).toBe(0.7);
    expect(result.isAdjacent).toBe(true);
  });

  it('should penalize overqualification', () => {
    const result = calculateSeniorityMatch('senior', 'junior', 8, 0.9);
    expect(result.score).toBe(0.3);
  });

  it('should give zero for underqualification', () => {
    const result = calculateSeniorityMatch('junior', 'senior', 2, 0.9);
    expect(result.score).toBe(0);
  });
});

describe('Experience Match', () => {
  it('should return 1.0 when meeting requirement', () => {
    const result = calculateExperienceMatch(5, 3);
    expect(result.score).toBe(1.0);
    expect(result.meetsRequirement).toBe(true);
  });

  it('should return partial score when not meeting requirement', () => {
    const result = calculateExperienceMatch(2, 5);
    expect(result.score).toBe(0.4);
    expect(result.meetsRequirement).toBe(false);
  });

  it('should return neutral when job has no requirement', () => {
    const result = calculateExperienceMatch(3, null);
    expect(result.score).toBe(1.0);
  });
});

describe('Years Extraction', () => {
  it('should extract years from description', () => {
    expect(extractYearsFromDescription('5+ years of experience')).toBe(5);
    expect(extractYearsFromDescription('3-5 years of experience')).toBe(3);
    expect(extractYearsFromDescription('minimum 2 years')).toBe(2);
  });

  it('should return null for no years mentioned', () => {
    expect(extractYearsFromDescription('great opportunity')).toBeNull();
  });
});

describe('Score Weights', () => {
  it('should sum to 1.0', () => {
    const { getScoreWeights } = require('@/lib/score-jobs/scoring-formula');
    const weights = getScoreWeights();
    const sum = Object.values(weights).reduce((a: number, b: unknown) => a + (typeof b === 'number' ? b : 0), 0);
    expect(sum).toBe(1.0);
  });

  it('should have skills as highest weight', () => {
    const { getScoreWeights } = require('@/lib/score-jobs/scoring-formula');
    const weights = getScoreWeights();
    expect(weights.skills).toBe(0.50);
  });
});
