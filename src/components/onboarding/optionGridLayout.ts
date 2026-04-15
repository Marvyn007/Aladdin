import type { CSSProperties } from 'react';

/**
 * Responsive option grid: packs short labels into multiple columns to reduce scroll.
 * Long labels fall back to a single full-width column.
 */
export function getOptionGridContainerStyle(
  labels: string[],
  opts?: { forceSingleColumn?: boolean }
): CSSProperties {
  if (opts?.forceSingleColumn || labels.length === 0) {
    return {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: '10px',
    };
  }

  const maxLen = labels.reduce((m, l) => Math.max(m, l.length), 0);

  // Only force a single column for genuinely long prose labels (e.g. sentences)
  if (maxLen > 52) {
    return {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: '10px',
    };
  }

  // Minimum track width scales with longest label (13px UI)
  let minPx = 118;
  if (maxLen > 32) minPx = 230;
  else if (maxLen > 22) minPx = 188;
  else if (maxLen > 14) minPx = 148;
  else minPx = 118;

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minPx}px), 1fr))`,
    gap: '10px',
  };
}
