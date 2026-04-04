'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOUR_STEPS } from './tourSteps';
import { AladdinCharacter } from './AladdinCharacter';
import { SpeechBubble } from './SpeechBubble';
import { SpotlightBox } from './SpotlightBox';
import {
  useTourTarget,
  getAladdinPosition,
  getAladdinSize,
  getSpeechBubbleWidth,
  isMirrored,
  type Position,
} from './useTourPositions';

type Phase = 'flying' | 'pointing';

interface TourOverlayProps {
  onComplete: () => Promise<void>;
}

/**
 * Full-screen overlay that runs the guided tour.
 * Manages the 3-phase state machine: flying → pointing → (next) → flying…
 */
export function TourOverlay({ onComplete }: TourOverlayProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('flying');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [aladdinPos, setAladdinPos] = useState<Position>({ x: 20, y: 20 });
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  const step = TOUR_STEPS[stepIndex];
  const aladdinSize = getAladdinSize(viewportWidth);
  const bubbleWidth = getSpeechBubbleWidth(viewportWidth);
  const mirrored = isMirrored(step.aladdinSide);

  const targetRect = useTourTarget(step.dataId, stepIndex);

  // Track viewport width for breakpoint-aware sizing
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When we have a target rect and phase is flying, move Aladdin toward the target
  useEffect(() => {
    if (targetRect && phase === 'flying') {
      const pos = getAladdinPosition(targetRect, step.aladdinSide, aladdinSize, viewportWidth);
      setAladdinPos(pos);
    }
  }, [targetRect, phase, step.aladdinSide, aladdinSize, viewportWidth]);

  // Called when Aladdin's CSS transition ends (arrives at target)
  const handleArrived = useCallback(() => {
    setPhase('pointing');
    setTimeout(() => setBubbleVisible(true), 100);
  }, []);

  // Called when user clicks Next / Finish
  const handleNext = useCallback(async () => {
    setBubbleVisible(false);

    if (stepIndex === TOUR_STEPS.length - 1) {
      // Finish
      setFinishing(true);
      await onComplete();
      setTimeout(() => router.push('/onboarding'), 1600);
      return;
    }

    // Pause briefly for bubble to fade out, then fly to next stop
    setTimeout(() => {
      setPhase('flying');
      setStepIndex((i) => i + 1);
    }, 250);
  }, [stepIndex, onComplete, router]);

  // Called when user clicks Skip Tour
  const handleSkip = useCallback(async () => {
    await onComplete();
    router.push('/onboarding');
  }, [onComplete, router]);

  // Lift the active target element above the blur overlay
  useEffect(() => {
    const el = document.querySelector(`[data-tour-id="${step.dataId}"]`) as HTMLElement | null;
    if (!el) return;

    const prevPosition = el.style.position;
    const prevZIndex = el.style.zIndex;
    const prevBorderRadius = el.style.borderRadius;

    el.style.position = 'relative';
    el.style.zIndex = '60';
    el.style.borderRadius = '8px';

    return () => {
      el.style.position = prevPosition;
      el.style.zIndex = prevZIndex;
      el.style.borderRadius = prevBorderRadius;
    };
  }, [step.dataId]);

  // Speech bubble offset relative to Aladdin
  const bubbleLeft =
    step.aladdinSide === 'left'
      ? aladdinPos.x + aladdinSize + 12
      : aladdinPos.x - bubbleWidth - 12;

  return (
    <>
      {/* Full-screen blur + dim overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          backdropFilter: 'blur(3px) brightness(0.55)',
          WebkitBackdropFilter: 'blur(3px) brightness(0.55)',
          background: 'rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}
      />

      {/* Spotlight box around active element */}
      {targetRect && phase === 'pointing' && (
        <SpotlightBox rect={targetRect} />
      )}

      {/* Aladdin character */}
      <AladdinCharacter
        position={aladdinPos}
        phase={phase}
        mirrored={mirrored}
        size={aladdinSize}
        onArrived={handleArrived}
      />

      {/* Speech bubble */}
      {phase === 'pointing' && (
        <div
          style={{
            position: 'fixed',
            top: aladdinPos.y,
            left: Math.max(8, Math.min(bubbleLeft, viewportWidth - bubbleWidth - 8)),
            zIndex: 63,
          }}
        >
          <SpeechBubble
            text={step.text}
            stepIndex={stepIndex}
            totalSteps={TOUR_STEPS.length}
            maxWidth={bubbleWidth}
            side={step.aladdinSide === 'left' ? 'right' : 'left'}
            onNext={handleNext}
            visible={bubbleVisible}
          />
        </div>
      )}

      {/* Skip Tour button — always visible */}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 70,
        }}
      >
        <button
          onClick={handleSkip}
          style={{
            padding: '8px 24px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(0,0,0,0.45)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.65)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; }}
        >
          Skip Tour
        </button>
      </div>

      {/* Finish overlay */}
      {finishing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: '40px 48px',
            textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          }}>
            <p style={{ fontSize: 32, margin: '0 0 12px' }}>🎉</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              You're all set!
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              Let's get you onboarded…
            </p>
          </div>
        </div>
      )}
    </>
  );
}
