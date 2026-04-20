import { describe, it, expect } from 'vitest';
import {
  applyOnePageDesignFromFull,
  buildTailoredResumeSavePayload,
  isTailoredResumeBundleV2,
  splitTailoredResumePayload,
} from '@/lib/tailored-resume-bundle';
import type { TailoredResumeBundleV2, TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN, TAILORED_RESUME_BUNDLE_VERSION } from '@/types';

const minimalResume = (id: string): TailoredResumeData => ({
  id,
  contact: { name: 'A', email: '', phone: '', linkedin: '', location: '', github: [] },
  summary: '',
  sections: [],
  skills: {},
  design: { ...DEFAULT_RESUME_DESIGN, fontSize: 12 },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

describe('tailored-resume-bundle', () => {
  it('isTailoredResumeBundleV2 detects v2', () => {
    const bundle: TailoredResumeBundleV2 = {
      _v: TAILORED_RESUME_BUNDLE_VERSION,
      full: minimalResume('1'),
      onePage: minimalResume('2'),
    };
    expect(isTailoredResumeBundleV2(bundle)).toBe(true);
    expect(isTailoredResumeBundleV2(minimalResume('x'))).toBe(false);
  });

  it('splitTailoredResumePayload handles legacy single resume', () => {
    const r = minimalResume('legacy');
    const { hasOnePage, full, onePage } = splitTailoredResumePayload(r);
    expect(hasOnePage).toBe(false);
    expect(full.id).toBe('legacy');
    expect(onePage).toBeNull();
  });

  it('splitTailoredResumePayload handles v2 bundle', () => {
    const bundle: TailoredResumeBundleV2 = {
      _v: TAILORED_RESUME_BUNDLE_VERSION,
      full: minimalResume('f'),
      onePage: minimalResume('o'),
    };
    const { hasOnePage, full, onePage } = splitTailoredResumePayload(bundle);
    expect(hasOnePage).toBe(true);
    expect(full.id).toBe('f');
    expect(onePage?.id).toBe('o');
  });

  it('buildTailoredResumeSavePayload returns bundle when one-page present', () => {
    const full = minimalResume('f');
    const one = minimalResume('o');
    const saved = buildTailoredResumeSavePayload(full, one);
    expect(isTailoredResumeBundleV2(saved)).toBe(true);
  });

  it('applyOnePageDesignFromFull tightens font and margins', () => {
    const d = { ...DEFAULT_RESUME_DESIGN, fontSize: 12, margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } };
    const next = applyOnePageDesignFromFull(d);
    expect(next.fontSize).toBeLessThanOrEqual(11);
    expect(next.fontSize).toBeGreaterThanOrEqual(10);
    expect(next.margins.top).toBeLessThanOrEqual(d.margins.top);
  });
});
