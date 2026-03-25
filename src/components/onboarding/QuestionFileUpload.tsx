'use client';

import { useRef, useState } from 'react';
import { Info, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

    // Validate type
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      event.currentTarget.value = '';
      return;
    }

    // Validate size (10MB)
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Uploading...' : value ? 'Replace file' : 'Upload PDF'}
        </Button>

        {showInfoTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="rounded-full p-1 text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
                <span className="sr-only">How to download LinkedIn PDF</span>
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
        className="hidden"
        onChange={handleFileChange}
      />

      {value && (
        <Badge variant="secondary" className="gap-1">
          <Upload className="h-3 w-3" />
          {value.filename}
        </Badge>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {question.helperText && !error && (
        <p className="text-xs text-muted-foreground">{question.helperText}</p>
      )}
    </div>
  );
}
