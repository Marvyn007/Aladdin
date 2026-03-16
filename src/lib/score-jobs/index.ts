/**
 * Score Jobs Pipeline - Public API
 * 
 * Main exports for the Score Jobs pipeline
 */

export { runScoreJobsPipeline, getPipelineConfig, setPipelineConfig } from './pipeline';
export { computeJobScore, getScoreWeights, setScoreWeights } from './scoring-formula';
export { extractJobInfo, extractCandidateInfo } from './extraction';
export { normalizeSkill, industriesMatch, getCanonicalSkills } from './skill-normalization';
export { determineSeniorityFromTitle, determineSeniorityFromExperience, calculateSeniorityMatch } from './seniority-rules';

export type {
  JobExtractionResult,
  CandidateProfile,
  ScoreResultV2,
  ScoreBreakdownV2,
  MatchedSkill,
  ExtractedSkill,
  CandidateSkill,
} from '@/types';
