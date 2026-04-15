'use client';

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="onboarding-theme"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--ot-bg)',
        color: 'var(--ot-text)',
        fontFamily: "'Open Sans', sans-serif",
      }}
    >
      <div className="onboarding-split">
        {/* Left: full-bleed image only */}
        <div className="onboarding-image-panel">
          <img
            src="/Onboarding stock.png"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Right: scrollable content */}
        <div
          className="onboarding-content-panel"
          style={{
            backgroundColor: 'var(--ot-bg)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
