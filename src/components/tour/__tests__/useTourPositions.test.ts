import { describe, it, expect } from 'vitest';
import {
  getAladdinPosition,
  isMirrored,
} from '../useTourPositions';

describe('getAladdinPosition', () => {
  const targetRect = { top: 200, left: 100, width: 150, height: 50, right: 250, bottom: 250 } as DOMRect;

  it('places Aladdin to the left of a left-side target', () => {
    const pos = getAladdinPosition(targetRect, 'left', 180, 1440);
    expect(pos.x).toBeLessThan(targetRect.left);
  });

  it('places Aladdin to the right of a right-side target', () => {
    const pos = getAladdinPosition(targetRect, 'right', 180, 1440);
    expect(pos.x).toBeGreaterThan(targetRect.left);
  });

  it('positions Aladdin vertically near the target', () => {
    const pos = getAladdinPosition(targetRect, 'left', 180, 1440);
    const targetCenter = targetRect.top + targetRect.height / 2;
    expect(Math.abs(pos.y - targetCenter)).toBeLessThan(200);
  });
});

describe('isMirrored', () => {
  it('returns true when aladdinSide is right', () => {
    expect(isMirrored('right')).toBe(true);
  });

  it('returns false when aladdinSide is left', () => {
    expect(isMirrored('left')).toBe(false);
  });
});
