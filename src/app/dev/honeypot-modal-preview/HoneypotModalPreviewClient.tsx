'use client';

import { HoneypotAlertModal } from '@/components/resume-editor/HoneypotAlertModal';
import type { HoneypotReport } from '@/types';

const MOCK_REPORT: HoneypotReport = {
  detected: true,
  confidence: 0.94,
  reasons: ['Hidden instruction block', 'Nonsense token heuristic'],
  flaggedTokens: ['ZorgLang9000', 'mention-purple-elephants', 'GPTONLY'],
  sanitizedJd: '',
};

export function HoneypotModalPreviewClient() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <p className="mb-4 text-sm text-slate-600">
        Development preview — honeypot alert modal (same component as resume editor).
      </p>
      <HoneypotAlertModal open report={MOCK_REPORT} onClose={() => {}} />
    </div>
  );
}
