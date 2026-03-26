'use client';

import { useRef, useState } from 'react';
import { Info, Upload } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { OnboardingQuestion } from '@/lib/onboarding';

interface FileUploadValue {
  resumeId: string;
  filename: string;
}

interface QuestionFileUploadProps {
  question: OnboardingQuestion;
  value: FileUploadValue | null;
  onChange: (val: FileUploadValue | null) => void;
  showInfoTooltip?: boolean;
}

const LINKEDIN_INSTRUCTIONS = `How to download your LinkedIn profile as PDF:
1. Click the Me icon at the top of your LinkedIn homepage.
2. Select View Profile.
3. Click the More button (in the introduction section below your name/headline).
4. Select Save to PDF from the dropdown menu.
5. The file will automatically download to your computer.`;

export function QuestionFileUpload({ question, value, onChange, showInfoTooltip }: QuestionFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      event.currentTarget.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10 MB or smaller.');
      event.currentTarget.value = '';
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint =
        question.key === 'linkedin_pdf' ? '/api/upload-linkedin' : '/api/upload-resume';

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as {
        resume?: { id: string; filename?: string };
        profile?: { id: string; filename?: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? 'Upload failed');
      }

      const id = data.resume?.id ?? data.profile?.id ?? '';
      const filename = file.name;
      onChange({ resumeId: id, filename });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      event.currentTarget.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            border: '1.5px solid var(--ot-ghost-border)',
            background: 'var(--ot-ghost-bg)',
            color: 'var(--ot-ghost-color)',
            outline: 'none',
            opacity: uploading ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <Upload style={{ width: 16, height: 16 }} />
          {uploading ? 'Uploading...' : value ? 'Replace file' : 'Upload PDF'}
        </button>

        {showInfoTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                style={{
                  borderRadius: '50%',
                  padding: 6,
                  color: 'var(--ot-text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Info style={{ width: 16, height: 16 }} />
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                  How to download LinkedIn PDF
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs whitespace-pre-line">
                {LINKEDIN_INSTRUCTIONS}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {value && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 500,
            border: '1px solid var(--ot-pill-border)',
            background: 'var(--ot-pill-bg)',
            color: 'var(--ot-pill-color)',
          }}
        >
          <Upload style={{ width: 12, height: 12 }} />
          {value.filename}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 13, color: 'var(--color-destructive)' }}>{error}</p>
      )}

      {question.helperText && !error && (
        <p style={{ fontSize: 13, color: 'var(--ot-text-muted)' }}>{question.helperText}</p>
      )}
    </div>
  );
}
