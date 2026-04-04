'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Position } from './useTourPositions';

type Phase = 'flying' | 'pointing';

interface AladdinCharacterProps {
  position: Position;
  phase: Phase;
  mirrored: boolean;
  size: number;
  onArrived: () => void;
}

const IMG_FRAME_A = '/aladdin-logo-animation-1.png';
const IMG_FRAME_B = '/aladdin-logo-animation-2.png';
const IMG_POINTING = '/aladdin-logo-animation.png';
const FRAME_INTERVAL_MS = 120;

/**
 * Renders the Aladdin character at a fixed position with animation:
 * - Flying phase: alternates between frame A/B at 120ms to simulate motion.
 * - Pointing phase: shows the pointing image, held still.
 * Mirrored (scaleX(-1)) when the target is on the right side of the screen.
 */
export function AladdinCharacter({
  position,
  phase,
  mirrored,
  size,
  onArrived,
}: AladdinCharacterProps) {
  const [frame, setFrame] = useState<'a' | 'b'>('a');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop frame alternation based on phase
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
    <div
      onTransitionEnd={(e) => {
        if (phase === 'flying' && e.propertyName === 'left') {
          onArrived();
        }
      }}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size,
        zIndex: 62,
        pointerEvents: 'none',
        transform: mirrored ? 'scaleX(-1)' : 'scaleX(1)',
        transition: 'left 700ms cubic-bezier(0.34, 1.56, 0.64, 1), top 700ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'left, top',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Aladdin"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        draggable={false}
      />
    </div>
  );
}
