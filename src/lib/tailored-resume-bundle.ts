import type { ResumeDesign, TailoredResumeBundleV2, TailoredResumeData } from '@/types';
import { TAILORED_RESUME_BUNDLE_VERSION } from '@/types';

export function isTailoredResumeBundleV2(value: unknown): value is TailoredResumeBundleV2 {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as TailoredResumeBundleV2)._v === TAILORED_RESUME_BUNDLE_VERSION &&
    !!(value as TailoredResumeBundleV2).full &&
    !!(value as TailoredResumeBundleV2).onePage
  );
}

/** Tighter typography for the one-page variant (deterministic; LLM handles content). */
export function applyOnePageDesignFromFull(fullDesign: ResumeDesign): ResumeDesign {
  const fontSize = Math.max(10, Math.min(11, fullDesign.fontSize - 1));
  const shrink = (n: number) => Math.max(0.35, Number((n - 0.08).toFixed(2)));
  return {
    ...fullDesign,
    fontSize,
    margins: {
      top: shrink(fullDesign.margins.top),
      right: shrink(fullDesign.margins.right),
      bottom: shrink(fullDesign.margins.bottom),
      left: shrink(fullDesign.margins.left),
    },
  };
}

export function splitTailoredResumePayload(raw: unknown): {
  hasOnePage: boolean;
  full: TailoredResumeData;
  onePage: TailoredResumeData | null;
} {
  if (isTailoredResumeBundleV2(raw)) {
    return { hasOnePage: true, full: raw.full, onePage: raw.onePage };
  }
  return { hasOnePage: false, full: raw as TailoredResumeData, onePage: null };
}

export function buildTailoredResumeSavePayload(
  full: TailoredResumeData,
  onePage: TailoredResumeData | null
): TailoredResumeData | TailoredResumeBundleV2 {
  if (!onePage) return full;
  return {
    _v: TAILORED_RESUME_BUNDLE_VERSION,
    full,
    onePage,
  };
}
