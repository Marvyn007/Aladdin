export type NavWaitUntil = 'load' | 'domcontentloaded' | 'networkidle';

function parseNavWait(raw: string | undefined, fallback: NavWaitUntil): NavWaitUntil {
  if (raw === 'networkidle' || raw === 'load' || raw === 'domcontentloaded') return raw;
  return fallback;
}

/** Tunables for Apply Pilot speed (env-driven for production tuning without code changes). */
export function getAutoApplyStagehandEnv() {
  const navWait = parseNavWait(process.env.AUTO_APPLY_NAV_WAIT, 'load');
  const postClickWait = parseNavWait(process.env.AUTO_APPLY_POST_CLICK_WAIT, 'load');
  const domSettleMs = Math.max(
    800,
    Number.parseInt(process.env.AUTO_APPLY_DOM_SETTLE_MS ?? '2800', 10) || 2800
  );
  const observeTimeout = Math.max(
    5000,
    Number.parseInt(process.env.AUTO_APPLY_OBSERVE_TIMEOUT_MS ?? '28000', 10) || 28000
  );
  const actTimeout = Math.max(
    8000,
    Number.parseInt(process.env.AUTO_APPLY_ACT_TIMEOUT_MS ?? '35000', 10) || 35000
  );

  const modelName =
    process.env.AUTO_APPLY_STAGEHAND_MODEL?.trim() || 'openai/gpt-4o-mini';

  return {
    navWait,
    postClickWait,
    domSettleMs,
    observeTimeout,
    actTimeout,
    modelName,
  };
}
