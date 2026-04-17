export type PlanType = 'LITE' | 'COPILOT' | 'CAPTAIN';
export type UsageFeature =
  | 'resumesGenerated'
  | 'coverLettersGenerated'
  | 'emailsRetrieved'
  | 'linkedinRetrieved';

export const STRIPE_PRICE_TO_PLAN: Record<string, PlanType> = {
  [process.env.STRIPE_PRICE_COPILOT ?? '']: 'COPILOT',
  [process.env.STRIPE_PRICE_CAPTAIN ?? '']: 'CAPTAIN',
};

export const UNLIMITED = 999999;
export const SOFT_CAP = 500;

export const TIER_LIMITS: Record<PlanType, Record<UsageFeature, number>> = {
  LITE: {
    resumesGenerated: 0,
    coverLettersGenerated: 0,
    emailsRetrieved: 0,
    linkedinRetrieved: 0,
  },
  COPILOT: {
    resumesGenerated: 15,
    coverLettersGenerated: 30,
    emailsRetrieved: 30,
    linkedinRetrieved: 60,
  },
  CAPTAIN: {
    resumesGenerated: 60,
    coverLettersGenerated: UNLIMITED,
    emailsRetrieved: 150,
    linkedinRetrieved: UNLIMITED,
  },
};
