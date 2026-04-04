import { describe, it, expect } from 'vitest';
import {
  getAladdinPosition,
  isMirrored,
  getAladdinSize,
  getSpeechBubbleWidth,
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

describe('getAladdinSize', () => {
  it('returns 300 at 1600px and above', () => {
    expect(getAladdinSize(1600)).toBe(300);
    expect(getAladdinSize(1920)).toBe(300);
  });

  it('returns 225 at 1280px to 1599px', () => {
    expect(getAladdinSize(1280)).toBe(225);
    expect(getAladdinSize(1599)).toBe(225);
  });

  it('returns 180 below 1280px', () => {
    expect(getAladdinSize(1024)).toBe(180);
    expect(getAladdinSize(1279)).toBe(180);
  });
});

describe('getSpeechBubbleWidth', () => {
  it('returns 340 at 1600px and above', () => {
    expect(getSpeechBubbleWidth(1600)).toBe(340);
  });

  it('returns 300 at 1280px to 1599px', () => {
    expect(getSpeechBubbleWidth(1280)).toBe(300);
    expect(getSpeechBubbleWidth(1599)).toBe(300);
  });

  it('returns 260 below 1280px', () => {
    expect(getSpeechBubbleWidth(1024)).toBe(260);
  });
});
