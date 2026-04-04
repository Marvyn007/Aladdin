'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Position } from './useTourPositions';

type Phase = 'flying' | 'pointing';

interface AladdinCharacterProps {
  position: Position;
  phase: Phase;
  mirrored: boolean;
  size: number;
  stepKey: number;
  onArrived: () => void;
}

const SPARKLES = [
  { left: '82%', top: '20%', delay: '0s',    size: 5 },
  { left: '94%', top: '48%', delay: '0.2s',  size: 4 },
  { left: '76%', top: '68%', delay: '0.38s', size: 6 },
  { left: '88%', top: '12%', delay: '0.14s', size: 3 },
  { left: '96%', top: '58%', delay: '0.28s', size: 4 },
];

const IMG_FRAME_A = '/aladdin-logo-animation-1.png';
const IMG_FRAME_B = '/aladdin-logo-animation-2.png';
const IMG_POINTING = '/aladdin-logo-animation.png';
const FRAME_INTERVAL_MS = 120;


export function AladdinCharacter({
  position,
  phase,
  mirrored,
  size,
  stepKey,
  onArrived,
}: AladdinCharacterProps) {
  const [frame, setFrame] = useState<'a' | 'b'>('a');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === 'flying') {
      intervalRef.current = setInterval(() => {
        setFrame((f) => (f === 'a' ? 'b' : 'a'));
      }, FRAME_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  const src =
    phase === 'pointing'
      ? IMG_POINTING
      : frame === 'a'
      ? IMG_FRAME_A
      : IMG_FRAME_B;

  return (
    <>
      <style>{`
        @keyframes sparkle-pop {
          0%   { opacity: 0; transform: scale(0) rotate(0deg); }
          35%  { opacity: 0.85; transform: scale(1) rotate(40deg); }
          100% { opacity: 0; transform: scale(0.4) translateY(7px) rotate(80deg); }
        }
      `}</style>

      <div
        onTransitionEnd={(e) => {
          if (phase === 'flying' && (e.propertyName === 'left' || e.propertyName === 'top')) {
            onArrived();
          }
        }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: size,
          zIndex: 112,
          pointerEvents: 'none',
          transform: mirrored ? 'scaleX(-1)' : undefined,
          transition: 'left 1300ms cubic-bezier(0.4, 0, 0.2, 1), top 1300ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'left, top',
        }}
      >
        {phase === 'flying' && SPARKLES.map((s, i) => (
          <div
            key={`${stepKey}-${i}`}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffe066 0%, #fbbf24 60%, transparent 100%)',
              boxShadow: '0 0 5px 2px rgba(251,191,36,0.55)',
              animation: `sparkle-pop 1.1s ease-out ${s.delay} infinite`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Aladdin"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          draggable={false}
        />
      </div>
    </>
  );
}
