export type CheckoutPlanKey = 'copilot' | 'captain';

export function getAllowedStripePriceIds(): { copilot: string; captain: string } {
  const copilot = process.env.STRIPE_PRICE_COPILOT ?? '';
  const captain = process.env.STRIPE_PRICE_CAPTAIN ?? '';
  return { copilot, captain };
}

/**
 * Resolves a recurring Price ID for Checkout. Only env-configured Copilot/Captain IDs are allowed.
 */
export function resolveCheckoutPriceId(input: {
  plan?: string;
  priceId?: string;
}): { priceId: string } | { error: string } {
  const { copilot, captain } = getAllowedStripePriceIds();
  const allowed = new Set([copilot, captain].filter(Boolean));

  const p = input.plan?.toLowerCase();
  if (p === 'copilot') {
    if (!copilot) return { error: 'Copilot billing is not configured (STRIPE_PRICE_COPILOT).' };
    return { priceId: copilot };
  }
  if (p === 'captain') {
    if (!captain) return { error: 'Captain billing is not configured (STRIPE_PRICE_CAPTAIN).' };
    return { priceId: captain };
  }

  if (input.priceId && allowed.has(input.priceId)) {
    return { priceId: input.priceId };
  }

  return { error: 'Provide a valid plan (copilot | captain) or an allowed priceId.' };
}
