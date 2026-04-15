'use client';

export const ONBOARDING_PROGRESS_LABELS = ['About you', 'Upload', 'Wrap up'] as const;

export type OnboardingProgressStep = 0 | 1 | 2;

export function OnboardingProgress({ activeIndex }: { activeIndex: OnboardingProgressStep }) {
  const progressPct = activeIndex === 0 ? 33 : activeIndex === 1 ? 66 : 100;
  const labels = ONBOARDING_PROGRESS_LABELS;

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {labels.map((label, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: done
                      ? 'var(--ot-primary)'
                      : active
                        ? 'var(--ot-primary-alpha)'
                        : 'var(--ot-step-inactive-bg)',
                    border: `1.5px solid ${done || active ? 'var(--ot-primary)' : 'var(--ot-step-inactive-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: done
                      ? 'var(--ot-primary-fg)'
                      : active
                        ? 'var(--ot-primary)'
                        : 'var(--ot-step-inactive-color)',
                    transition: 'all 0.25s ease',
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    color: active
                      ? 'var(--ot-text)'
                      : done
                        ? 'var(--ot-step-done-color)'
                        : 'var(--ot-step-inactive-color)',
                    transition: 'color 0.25s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
                {i < labels.length - 1 && (
                  <div
                    style={{
                      width: 12,
                      height: 1,
                      background: 'var(--ot-track-bg)',
                      marginLeft: 2,
                      marginRight: 2,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: 'var(--ot-text-muted)', flexShrink: 0 }}>{progressPct}%</span>
      </div>

      <div
        style={{
          height: 3,
          borderRadius: 9999,
          background: 'var(--ot-track-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            borderRadius: 9999,
            background: 'var(--ot-primary-gradient)',
            transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}
