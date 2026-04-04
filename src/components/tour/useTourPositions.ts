import { useEffect, useRef, useState, useCallback } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export function getAladdinPosition(
  rect: TargetRect,
  aladdinSide: 'left' | 'right',
  aladdinWidth: number,
  viewportWidth: number,
): Position {
  const targetCenterY = rect.top + rect.height / 2;

  if (aladdinSide === 'left') {
    const x = Math.max(8, rect.left - aladdinWidth - 16);
    const y = Math.max(8, targetCenterY - aladdinWidth * 0.6);
    return { x, y };
  } else {
    const x = Math.min(viewportWidth - aladdinWidth - 8, rect.right + 16);
    const y = Math.max(8, targetCenterY - aladdinWidth * 0.6);
    return { x, y };
  }
}

export function isMirrored(aladdinSide: 'left' | 'right'): boolean {
  return aladdinSide === 'right';
}

export function getAladdinSize(viewportWidth: number): number {
  if (viewportWidth >= 1600) return 300;
  if (viewportWidth >= 1280) return 225;
  return 180;
}

export function getSpeechBubbleWidth(viewportWidth: number): number {
  if (viewportWidth >= 1600) return 340;
  if (viewportWidth >= 1280) return 300;
  return 260;
}

export function useTourTarget(dataId: string, stepIndex: number): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour-id="${dataId}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [dataId]);

  useEffect(() => {
    measure();

    const el = document.querySelector(`[data-tour-id="${dataId}"]`);
    if (el) {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(el);
    }

    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [dataId, stepIndex, measure]);

  return rect;
}
