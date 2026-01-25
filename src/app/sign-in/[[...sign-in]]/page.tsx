'use client';

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
    AuthCard,
    AuthDivider,
    AuthError,
    EnvWarningBanner,
    ProviderButton,
    AuthInput,
} from '@/components/auth';

export default function SignInPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleOAuthSignIn = async (provider: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded || !signIn) return;

        try {
            await signIn.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/sign-in/sso-callback',
                redirectUrlComplete: '/',
            });
        } catch (err: any) {
            setError(err.errors?.[0]?.message || 'OAuth sign-in failed');
        }
    };

    const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;

        setError(null);
        setIsLoading(true);

        // Client-side validation
        if (!email.trim()) {
            setError('Email is required');
            setIsLoading(false);
            return;
        }
        if (!password) {
            setError('Password is required');
            setIsLoading(false);
            return;
        }

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.push('/');
            } else {
                // Handle additional steps if needed (e.g., 2FA)
                console.log('Sign-in requires additional steps:', result);
                setError('Additional verification required. Please check your email.');
            }
        } catch (err: any) {
            const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign-in failed';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <EnvWarningBanner />
            <AuthCard
                title="Sign in to your account"
                footerText="Don't have an account?"
                footerLinkText="Sign up."
                footerLinkHref="/sign-up"
            >
                {/* OAuth Providers */}
                <div className="auth-providers">
                    <ProviderButton
                        provider="google"
                        onClick={() => handleOAuthSignIn('oauth_google')}
                        disabled={!isLoaded}
                    />
                    <ProviderButton
                        provider="github"
                        onClick={() => handleOAuthSignIn('oauth_github')}
                        disabled={!isLoaded}
                    />
                </div>

                <AuthDivider />

                {/* Email/Password Form */}
                <form onSubmit={handleEmailPasswordSignIn} className="auth-form">
                    <AuthError message={error} />

                    <AuthInput
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={isLoading}
                        required
                    />

                    <AuthInput
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={isLoading}
                        required
                    />

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={isLoading || !isLoaded}
                    >
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </AuthCard>
        </>
    );
}
