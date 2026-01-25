'use client';

import Image from 'next/image';
import Link from 'next/link';

interface AuthCardProps {
    title: string;
    children: React.ReactNode;
    footerText: string;
    footerLinkText: string;
    footerLinkHref: string;
}

export function AuthCard({
    title,
    children,
    footerText,
    footerLinkText,
    footerLinkHref,
}: AuthCardProps) {
    return (
        <div className="auth-page">
            {/* Logo */}
            <div className="auth-logo">
                <Image
                    src="/aladdin-logo.png"
                    alt="Aladdin"
                    width={180}
                    height={60}
                    priority
                />
            </div>

            {/* Card */}
            <div className="auth-card">
                <h1 className="auth-title">{title}</h1>
                {children}
                <p className="auth-footer">
                    {footerText}{' '}
                    <Link href={footerLinkHref} className="auth-link">
                        {footerLinkText}
                    </Link>
                </p>
            </div>
        </div>
    );
}

export function AuthDivider() {
    return (
        <div className="auth-divider">
            <span>or</span>
        </div>
    );
}

export function AuthError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div className="auth-error" role="alert" aria-live="polite">
            {message}
        </div>
    );
}

export function EnvWarningBanner() {
    const hasClerkKey = typeof window !== 'undefined'
        ? !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
        : true;

    if (hasClerkKey) return null;

    return (
        <div className="auth-env-warning" role="alert">
            <strong>⚠️ Clerk not configured</strong>
            <p>Set these environment variables in <code>.env.local</code>:</p>
            <ul>
                <li><code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code></li>
                <li><code>CLERK_SECRET_KEY</code></li>
            </ul>
        </div>
    );
}
