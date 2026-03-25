import './theme.css';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-theme dark min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
