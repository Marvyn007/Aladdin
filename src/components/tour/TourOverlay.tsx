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

export function TourOverlay({ onComplete }: TourOverlayProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('flying');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [aladdinPos, setAladdinPos] = useState<Position>({ x: -300, y: -300 }); // off-screen until logo found
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  const completingRef = useRef(false);
  const returningRef = useRef(false);   // true while flying back to logo
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoElRef = useRef<HTMLElement | null>(null);
  const logoRectRef = useRef<Position | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const aladdinSize = getAladdinSize(viewportWidth);
  const bubbleWidth = getSpeechBubbleWidth(viewportWidth);
  const mirrored = isMirrored(step.aladdinSide);
  const effectiveBubbleSide: 'left' | 'right' =
    step.bubbleSide ?? (step.aladdinSide === 'left' ? 'right' : 'left');

  const targetRect = useTourTarget(step.dataId, stepIndex);

  // On mount: hide the sidebar logo and start Aladdin from its exact position
  useEffect(() => {
    const logoEl = document.querySelector(
      '[data-tour-id="aladdin-sidebar-logo"]',
    ) as HTMLElement | null;
    if (logoEl) {
      logoElRef.current = logoEl;
      const rect = logoEl.getBoundingClientRect();
      const pos = { x: rect.left, y: rect.top };
      logoRectRef.current = pos;
      setAladdinPos(pos);
      logoEl.style.visibility = 'hidden';
    }
  }, []);

  // Track viewport width for breakpoint-aware sizing
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleArrived = useCallback(() => {
    if (returningRef.current) return; // ignore arrival while flying back to logo
    if (arrivalTimerRef.current) {
      clearTimeout(arrivalTimerRef.current);
      arrivalTimerRef.current = null;
    }
    setPhase('pointing');
    setTimeout(() => setBubbleVisible(true), 250);
  }, []);

  // Move Aladdin toward target when flying
  useEffect(() => {
    if (returningRef.current) return;
    if (targetRect && phase === 'flying') {
      const pos = getAladdinPosition(targetRect, step.aladdinSide, aladdinSize, viewportWidth);
      setAladdinPos(pos);

      if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
      arrivalTimerRef.current = setTimeout(() => handleArrived(), 1500);
    }
    return () => {
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current);
        arrivalTimerRef.current = null;
      }
    };
  }, [targetRect, phase, step.aladdinSide, aladdinSize, viewportWidth, handleArrived]);

  /** Fly Aladdin back to the sidebar logo, show it, then navigate. */
  const returnToLogo = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;

    setBubbleVisible(false);
    await onComplete();

    returningRef.current = true;
    setPhase('flying'); // show flying animation during return

    if (logoRectRef.current) {
      setAladdinPos(logoRectRef.current);
      // After the transition (650ms), reveal the logo so the swap is invisible
      setTimeout(() => {
        if (logoElRef.current) logoElRef.current.style.visibility = '';
      }, 1250);
    }
    // Navigate after the full return flight
    setTimeout(() => router.push('/onboarding'), 1450);
  }, [onComplete, router]);

  const handleNext = useCallback(async () => {
    setBubbleVisible(false);

    if (stepIndex === TOUR_STEPS.length - 1) {
      await returnToLogo();
      return;
    }

    setTimeout(() => {
      setPhase('flying');
      setStepIndex((i) => i + 1);
    }, 500);
  }, [stepIndex, returnToLogo]);

  const handleSkip = useCallback(async () => {
    await returnToLogo();
  }, [returnToLogo]);

  // Speech bubble position
  const bubbleLeft =
    effectiveBubbleSide === 'right'
      ? aladdinPos.x + aladdinSize + 12
      : aladdinPos.x - bubbleWidth - 12;

  return (
    <>
      {/* Minimal border around the active element */}
      {targetRect && phase === 'pointing' && !returningRef.current && (
        <SpotlightBox rect={targetRect} />
      )}

      <AladdinCharacter
        position={aladdinPos}
        phase={phase}
        mirrored={mirrored}
        size={aladdinSize}
        stepKey={stepIndex}
        onArrived={handleArrived}
      />

      {/* Speech bubble */}
      {phase === 'pointing' && !returningRef.current && (
        <div
          style={{
            position: 'fixed',
            top: aladdinPos.y,
            left: Math.max(8, Math.min(bubbleLeft, viewportWidth - bubbleWidth - 8)),
            zIndex: 115,
          }}
        >
          <SpeechBubble
            text={step.text}
            stepIndex={stepIndex}
            totalSteps={TOUR_STEPS.length}
            maxWidth={bubbleWidth}
            side={effectiveBubbleSide === 'right' ? 'right' : 'left'}
            onNext={handleNext}
            visible={bubbleVisible}
          />
        </div>
      )}

      {/* Skip Tour button */}
      {!returningRef.current && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 120,
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
      )}
    </>
  );
}
