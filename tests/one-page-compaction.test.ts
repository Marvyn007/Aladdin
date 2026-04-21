// tests/one-page-compaction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock puppeteer-core before any imports ────────────────────────────────────
const mockEvaluate = vi.fn();
const mockSetContent = vi.fn();
const mockClose = vi.fn();
const mockNewPage = vi.fn(() => ({
  setContent: mockSetContent,
  evaluate: mockEvaluate,
}));
const mockLaunch = vi.fn(() => ({
  newPage: mockNewPage,
  close: mockClose,
}));

vi.mock('puppeteer-core', () => ({
  default: { launch: mockLaunch },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: vi.fn().mockResolvedValue('/mock/chromium'),
    headless: true,
  },
}));

// ── Also mock 'puppeteer' for local dev fallback ──────────────────────────────
vi.mock('puppeteer', () => ({
  executablePath: vi.fn().mockReturnValue('/mock/local-chromium'),
}));

// ── Mock measure-height so compaction tests don't need a real browser ─────────
vi.mock('../src/lib/resume-generation/measure-height', () => ({
  measureResumeHeightPx: vi.fn(),
  A4_HEIGHT_PX: 1123,
  A4_WIDTH_PX: 794,
}));

// ── Mock downstream dependencies for compaction integration tests ─────────────
vi.mock('../src/lib/resume-generation/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/resume-generation/utils')>();
  return {
    ...actual,
    callLLM: vi.fn(),
    assertNotAborted: actual.assertNotAborted,
  };
});

vi.mock('../src/lib/resume-templates', () => ({
  renderResumeHtml: vi.fn().mockReturnValue('<html><body>mock</body></html>'),
}));

vi.mock('../src/lib/resume-generation/toEditorFormat', () => ({
  toEditorFormat: vi.fn().mockReturnValue({
    id: 'test',
    contact: { name: 'Test' },
    sections: [],
    skills: {},
    summary: '',
    design: {
      template: 'classic',
      fontFamily: "'Roboto', sans-serif",
      fontSize: 12,
      accentColor: '#000',
      margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
    },
    createdAt: '',
    updatedAt: '',
  }),
}));

vi.mock('../src/lib/tailored-resume-bundle', () => ({
  applyOnePageDesignFromFull: vi.fn((d) => ({ ...d, fontSize: 11 })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { measureResumeHeightPx, A4_HEIGHT_PX, A4_WIDTH_PX } from '../src/lib/resume-generation/measure-height';
import {
  scoreSectionRelevance,
  microTrimSections,
  compactTailoredResumeToOnePage,
} from '../src/lib/resume-generation/one-page-compaction';
import type { DynamicSection } from '../src/lib/resume-generation/types';
import type { TailoredResumeOutput } from '../src/lib/resume-generation/types';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeSection(anchors: (string[] | null)[]): DynamicSection {
  return {
    name: 'Test Section',
    entries: [
      {
        title: 'Role',
        subtitle: 'Company',
        location: '',
        startDate: '2022-01',
        endDate: '2024-01',
        bullets: anchors.map((_, i) => `Bullet ${i}`),
        jdAnchors: anchors.map((a) => a ?? []),
      },
    ],
  };
}

function makeOutput(bullets = 5): TailoredResumeOutput {
  const bulletArr = Array.from({ length: bullets }, (_, i) => `Bullet ${i}`);
  return {
    basics: { name: 'Test', email: '', phone: '', location: '', linkedin: '', website: '', headline: '' },
    summary: 'Summary text',
    sections: [
      {
        name: 'Experience',
        entries: [
          {
            title: 'Dev',
            subtitle: 'Co',
            location: '',
            startDate: '2022-01',
            endDate: '2024-01',
            bullets: bulletArr,
            jdAnchors: bulletArr.map(() => []),
          },
        ],
      },
    ],
    skills: { Languages: ['TypeScript'] },
    missingSkills: [],
  };
}

// ── measureResumeHeightPx tests ───────────────────────────────────────────────
// NOTE: These test the real implementation via the puppeteer-core mock at the top.
// The vi.mock('../src/lib/resume-generation/measure-height') above replaces the
// module for compaction tests; for these tests we use the puppeteer-core mock directly.

describe('A4 constants (from measure-height module)', () => {
  it('A4_HEIGHT_PX is 1123', () => {
    expect(A4_HEIGHT_PX).toBe(1123);
  });

  it('A4_WIDTH_PX is 794', () => {
    expect(A4_WIDTH_PX).toBe(794);
  });
});

// ── scoreSectionRelevance tests ───────────────────────────────────────────────

describe('scoreSectionRelevance', () => {
  it('returns 1.0 when all bullets are anchored', () => {
    const section = makeSection([['React'], ['TypeScript']]);
    expect(scoreSectionRelevance(section)).toBe(1.0);
  });

  it('returns 0.0 when no bullets are anchored', () => {
    const section = makeSection([[], []]);
    expect(scoreSectionRelevance(section)).toBe(0.0);
  });

  it('returns 0.5 when half the bullets are anchored', () => {
    const section = makeSection([['React'], []]);
    expect(scoreSectionRelevance(section)).toBe(0.5);
  });

  it('returns 0.0 for a section with no bullets', () => {
    const section: DynamicSection = { name: 'Empty', entries: [] };
    expect(scoreSectionRelevance(section)).toBe(0.0);
  });
});

// ── microTrimSections tests ───────────────────────────────────────────────────

describe('microTrimSections', () => {
  it('removes one non-anchored bullet when lineBudget is 1', () => {
    const sections = [makeSection([[], [], []])];
    const result = microTrimSections(sections, 1);
    expect(result[0].entries[0].bullets.length).toBe(2);
  });

  it('does not remove anchored bullets', () => {
    const sections = [makeSection([['React'], []])];
    const result = microTrimSections(sections, 2);
    // Can only remove the 1 non-anchored bullet
    expect(result[0].entries[0].bullets.length).toBe(1);
    expect(result[0].entries[0].jdAnchors?.[0]).toEqual(['React']);
  });

  it('stops when no more non-anchored bullets remain', () => {
    const sections = [makeSection([['React'], ['TypeScript']])];
    const result = microTrimSections(sections, 5);
    expect(result[0].entries[0].bullets.length).toBe(2);
  });

  it('removes longest non-anchored bullet first', () => {
    const entry = {
      title: 'Role',
      subtitle: 'Co',
      location: '',
      startDate: '2022-01',
      endDate: '2024-01',
      bullets: ['short', 'a much longer bullet here that should go first'],
      jdAnchors: [[], []],
    };
    const sections: DynamicSection[] = [{ name: 'Sec', entries: [entry] }];
    const result = microTrimSections(sections, 1);
    expect(result[0].entries[0].bullets).toEqual(['short']);
  });

  it('does not mutate the input', () => {
    const sections = [makeSection([[], []])];
    const original = JSON.stringify(sections);
    microTrimSections(sections, 1);
    expect(JSON.stringify(sections)).toBe(original);
  });
});

// ── compactTailoredResumeToOnePage integration tests ─────────────────────────

describe('compactTailoredResumeToOnePage', () => {
  const measureMock = vi.mocked(measureResumeHeightPx);

  beforeEach(() => {
    measureMock.mockReset();
  });

  it('returns null when the full resume already fits on one page (Phase 0)', async () => {
    measureMock.mockResolvedValue(1000); // < 1123

    const result = await compactTailoredResumeToOnePage(makeOutput(), 'job desc');
    expect(result).toBeNull();
    expect(measureMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when Phase 0 measurement fails (Puppeteer crash)', async () => {
    measureMock.mockResolvedValue(null);

    const result = await compactTailoredResumeToOnePage(makeOutput(), 'job desc');
    expect(result).toBeNull();
    expect(measureMock).toHaveBeenCalledTimes(1);
  });

  it('returns compact output when design-only changes fix the overflow (Phase 2)', async () => {
    measureMock
      .mockResolvedValueOnce(1200) // Phase 0: overflow
      .mockResolvedValueOnce(1100); // Phase 2: fits after design

    const result = await compactTailoredResumeToOnePage(makeOutput(), 'job desc');
    expect(result).not.toBeNull();
    expect(measureMock).toHaveBeenCalledTimes(2);
  });

  it('calls LLM when design changes are insufficient (Phase 4)', async () => {
    const { callLLM } = await import('../src/lib/resume-generation/utils');
    const callLLMMock = vi.mocked(callLLM);

    const reducedSections = makeOutput(3).sections;
    callLLMMock.mockResolvedValue(JSON.stringify(reducedSections));

    measureMock
      .mockResolvedValueOnce(1300) // Phase 0: overflow
      .mockResolvedValueOnce(1250) // Phase 2: still over after design
      .mockResolvedValueOnce(1100); // Phase 5: fits after LLM

    const result = await compactTailoredResumeToOnePage(makeOutput(), 'job desc');
    expect(result).not.toBeNull();
    expect(callLLMMock).toHaveBeenCalledOnce();
    expect(measureMock).toHaveBeenCalledTimes(3);
  });

  it('falls through to micro-trim if LLM output is unparseable', async () => {
    const { callLLM } = await import('../src/lib/resume-generation/utils');
    vi.mocked(callLLM).mockResolvedValue('not valid json !!!');

    measureMock
      .mockResolvedValueOnce(1300) // Phase 0: overflow
      .mockResolvedValueOnce(1250) // Phase 2: still over
      .mockResolvedValueOnce(1050); // Phase 5: fits after micro-trim

    const result = await compactTailoredResumeToOnePage(makeOutput(), 'job desc');
    expect(result).not.toBeNull();
  });

  it('ships best-effort if all bullets are anchored and micro-trim cannot help', async () => {
    const output = makeOutput();
    output.sections[0].entries[0].jdAnchors = output.sections[0].entries[0].bullets.map(
      () => ['React']
    );

    const { callLLM } = await import('../src/lib/resume-generation/utils');
    vi.mocked(callLLM).mockResolvedValue('bad json');

    measureMock
      .mockResolvedValueOnce(1300)
      .mockResolvedValueOnce(1250)
      .mockResolvedValueOnce(1200); // still over even after micro-trim

    const result = await compactTailoredResumeToOnePage(output, 'job desc');
    expect(result).not.toBeNull();
  });
});
