import './theme.css';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-theme dark">
      {children}
    </div>
  );
}
