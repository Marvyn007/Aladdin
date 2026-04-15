/**
 * Local dev: run Browserbase auto-apply in-process (no Inngest executor / signing).
 * Production: use Inngest unless AUTO_APPLY_INLINE=true (long runs may hit platform limits).
 */
export function shouldUseInlineAutoApply(env: NodeJS.ProcessEnv): boolean {
  const v = env.AUTO_APPLY_INLINE;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return env.NODE_ENV !== 'production';
}
