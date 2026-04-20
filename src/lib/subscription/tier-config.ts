export type PlanType = 'LITE' | 'COPILOT' | 'CAPTAIN';
export type UsageFeature =
  | 'resumesGenerated'
  | 'coverLettersGenerated'
  | 'emailsRetrieved'
  | 'linkedinRetrieved';

const copilotPrice = process.env.STRIPE_PRICE_COPILOT ?? '';
const captainPrice = process.env.STRIPE_PRICE_CAPTAIN ?? '';

export const STRIPE_PRICE_TO_PLAN: Record<string, PlanType> = {
  ...(copilotPrice ? { [copilotPrice]: 'COPILOT' as const } : {}),
  ...(captainPrice ? { [captainPrice]: 'CAPTAIN' as const } : {}),
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
