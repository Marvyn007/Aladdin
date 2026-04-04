'use client';

import React from 'react';

interface SpotlightBoxProps {
  rect: DOMRect;
  padding?: number;
}

/**
 * Minimal border outline around the active tour target.
 * No dimming, no blur — the page stays completely normal.
 */
export function SpotlightBox({ rect, padding = 6 }: SpotlightBoxProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        border: '2px solid rgba(99,102,241,0.75)',
        borderRadius: 8,
        boxShadow: '0 0 0 3px rgba(99,102,241,0.12)',
        zIndex: 110,
        pointerEvents: 'none',
        transition: 'top 600ms ease, left 600ms ease, width 600ms ease, height 600ms ease',
      }}
    />
  );
}
