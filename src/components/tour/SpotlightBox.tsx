'use client';

import React from 'react';

interface SpotlightBoxProps {
  rect: DOMRect;
  padding?: number;
}

/**
 * Renders a glowing gold border over the active tour target element.
 * Positioned using fixed coordinates from getBoundingClientRect().
 */
export function SpotlightBox({ rect, padding = 6 }: SpotlightBoxProps) {
  return (
    <>
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 4px rgba(255, 200, 50, 0.25),
              0 0 20px rgba(255, 200, 50, 0.4);
          }
          50% {
            box-shadow:
              0 0 0 6px rgba(255, 200, 50, 0.35),
              0 0 32px rgba(255, 200, 50, 0.6);
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          border: '2px solid rgba(255, 200, 50, 0.9)',
          borderRadius: 10,
          animation: 'spotlight-pulse 1.5s ease-in-out infinite',
          zIndex: 61,
          pointerEvents: 'none',
          transition: 'top 400ms ease, left 400ms ease, width 400ms ease, height 400ms ease',
        }}
      />
    </>
  );
}
