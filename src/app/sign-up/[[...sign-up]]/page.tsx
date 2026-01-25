'use client';

import { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
    AuthCard,
    AuthDivider,
    AuthError,
    EnvWarningBanner,
    ProviderButton,
    AuthInput,
} from '@/components/auth';

export default function SignUpPage() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingVerification, setPendingVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    const handleOAuthSignUp = async (provider: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded || !signUp) return;

        try {
            await signUp.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/sign-up/sso-callback',
                redirectUrlComplete: '/',
            });
        } catch (err: any) {
            setError(err.errors?.[0]?.message || 'OAuth sign-up failed');
        }
    };

    const handleEmailPasswordSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signUp) return;

        setError(null);
        setIsLoading(true);

        // Client-side validation
        if (!email.trim()) {
            setError('Email is required');
            setIsLoading(false);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            setIsLoading(false);
            return;
        }

        if (!password) {
            setError('Password is required');
            setIsLoading(false);
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }

        try {
            await signUp.create({
                emailAddress: email,
                password,
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
            });

            // Send email verification
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setPendingVerification(true);
        } catch (err: any) {
            const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign-up failed';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signUp) return;

        setError(null);
        setIsLoading(true);

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                router.push('/');
            } else {
                setError('Verification incomplete. Please try again.');
            }
        } catch (err: any) {
            const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Email verification step
    if (pendingVerification) {
        return (
            <AuthCard
                title="Verify your email"
                footerText="Didn't receive a code?"
                footerLinkText="Resend"
                footerLinkHref="#"
            >
                <form onSubmit={handleVerifyEmail} className="auth-form">
                    <p className="auth-verification-text">
                        We sent a verification code to <strong>{email}</strong>
                    </p>

                    <AuthError message={error} />

                    <AuthInput
                        type="text"
                        name="code"
                        placeholder="Verification code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        autoComplete="one-time-code"
                        disabled={isLoading}
                        required
                    />

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={isLoading || !isLoaded}
                    >
                        {isLoading ? 'Verifying...' : 'Verify email'}
                    </button>
                </form>
            </AuthCard>
        );
    }

    return (
        <>
            <EnvWarningBanner />
            <AuthCard
                title="Create your account"
                footerText="Already have an account?"
                footerLinkText="Sign in."
                footerLinkHref="/sign-in"
            >
                {/* OAuth Providers */}
                <div className="auth-providers">
                    <ProviderButton
                        provider="google"
                        onClick={() => handleOAuthSignUp('oauth_google')}
                        disabled={!isLoaded}
                    />
                    <ProviderButton
                        provider="github"
                        onClick={() => handleOAuthSignUp('oauth_github')}
                        disabled={!isLoaded}
                    />
                </div>

                <AuthDivider />

                {/* Email/Password Form */}
                <form onSubmit={handleEmailPasswordSignUp} className="auth-form">
                    <AuthError message={error} />

                    <div className="auth-name-row">
                        <AuthInput
                            type="text"
                            name="firstName"
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            disabled={isLoading}
                        />
                        <AuthInput
                            type="text"
                            name="lastName"
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            disabled={isLoading}
                        />
                    </div>

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
                        autoComplete="new-password"
                        disabled={isLoading}
                        required
                    />

                    <AuthInput
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={isLoading}
                        required
                    />

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={isLoading || !isLoaded}
                    >
                        {isLoading ? 'Creating account...' : 'Sign up'}
                    </button>
                </form>
            </AuthCard>
        </>
    );
}
