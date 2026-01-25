'use client';

import { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Check if Clerk is configured
const isClerkConfigured = () => {
    return !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
};

export default function SignInPage() {
    const router = useRouter();
    const { signIn, isLoaded: signInLoaded } = useSignIn();
    const { signUp, isLoaded: signUpLoaded } = useSignUp();

    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    // Show debug banner if Clerk keys are missing
    if (!isClerkConfigured()) {
        return (
            <div style={styles.container}>
                <div style={{
                    ...styles.card,
                    background: '#fef3c7',
                    border: '2px solid #f59e0b',
                }}>
                    <h2 style={{ color: '#92400e', marginBottom: '16px' }}>⚠️ Clerk Configuration Required</h2>
                    <p style={{ color: '#78350f', marginBottom: '12px' }}>
                        The following environment variables are required:
                    </p>
                    <ul style={{ color: '#78350f', textAlign: 'left', paddingLeft: '20px' }}>
                        <li><code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code></li>
                        <li><code>CLERK_SECRET_KEY</code></li>
                    </ul>
                    <p style={{ color: '#78350f', marginTop: '12px', fontSize: '14px' }}>
                        Get these from your Clerk Dashboard.
                    </p>
                </div>
            </div>
        );
    }

    const handleOAuthSignIn = async (provider: 'oauth_google' | 'oauth_github') => {
        if (!signIn) return;

        try {
            await signIn.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/',
            });
        } catch (err: any) {
            setError(err.errors?.[0]?.message || 'OAuth sign in failed');
        }
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signIn) return;

        setError('');
        setIsLoading(true);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                await result.createdSessionId;
                router.push('/');
            } else {
                setError('Sign in requires additional verification');
            }
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign in failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signUp) return;

        // Client-side validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (!email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const result = await signUp.create({
                emailAddress: email,
                password,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
            });

            // Prepare email verification
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setShowVerification(true);
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign up failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signUp) return;

        setError('');
        setIsLoading(true);

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result.status === 'complete') {
                router.push('/');
            } else {
                setError('Verification incomplete');
            }
        } catch (err: any) {
            setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (!signInLoaded || !signUpLoaded) {
        return (
            <div style={styles.container}>
                <div style={styles.loadingSpinner} />
            </div>
        );
    }

    // Verification screen
    if (showVerification) {
        return (
            <div style={styles.container}>
                <div style={styles.logoSection}>
                    <Image
                        src="/aladdin-logo.png"
                        alt="Aladdin Logo"
                        width={50}
                        height={50}
                        style={{ objectFit: 'contain' }}
                    />
                    <span style={styles.logoText}>Aladdin</span>
                </div>

                <div style={styles.card}>
                    <h1 style={styles.title}>Verify your email</h1>
                    <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>
                        We sent a verification code to {email}
                    </p>

                    <form onSubmit={handleVerification}>
                        <input
                            type="text"
                            placeholder="Verification code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            style={styles.input}
                            aria-label="Verification code"
                        />

                        {error && <div style={styles.error}>{error}</div>}

                        <button
                            type="submit"
                            style={styles.submitButton}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Verifying...' : 'Verify Email'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Logo Section */}
            <div style={styles.logoSection}>
                <Image
                    src="/aladdin-logo.png"
                    alt="Aladdin Logo"
                    width={50}
                    height={50}
                    style={{ objectFit: 'contain' }}
                />
                <span style={styles.logoText}>Aladdin</span>
            </div>

            {/* Auth Card */}
            <div style={styles.card}>
                <h1 style={styles.title}>
                    {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
                </h1>

                {/* OAuth Buttons */}
                <button
                    onClick={() => handleOAuthSignIn('oauth_google')}
                    style={styles.googleButton}
                    aria-label="Continue with Google"
                >
                    <div style={styles.iconWrapper}>
                        <Image
                            src="/google-icon.png"
                            alt="Google"
                            width={20}
                            height={20}
                            style={{ objectFit: 'contain' }}
                        />
                    </div>
                    <span style={styles.oauthButtonText}>
                        <span style={{ color: '#4285F4', fontWeight: 600 }}>G</span> Continue with Google
                    </span>
                </button>

                <button
                    onClick={() => handleOAuthSignIn('oauth_github')}
                    style={styles.githubButton}
                    aria-label="Continue with GitHub"
                >
                    <div style={styles.iconWrapperGithub}>
                        <Image
                            src="/github-icon.png"
                            alt="GitHub"
                            width={20}
                            height={20}
                            style={{ objectFit: 'contain' }}
                        />
                    </div>
                    <span style={styles.oauthButtonText}>Continue with GitHub</span>
                </button>

                {/* Divider */}
                <div style={styles.divider}>
                    <div style={styles.dividerLine} />
                    <span style={styles.dividerText}>or</span>
                    <div style={styles.dividerLine} />
                </div>

                {/* Email/Password Form */}
                <form onSubmit={mode === 'signin' ? handleEmailSignIn : handleEmailSignUp}>
                    {mode === 'signup' && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '0' }}>
                            <input
                                type="text"
                                placeholder="First name (optional)"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                style={{ ...styles.input, flex: 1 }}
                                aria-label="First name"
                            />
                            <input
                                type="text"
                                placeholder="Last name (optional)"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                style={{ ...styles.input, flex: 1 }}
                                aria-label="Last name"
                            />
                        </div>
                    )}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        required
                        aria-label="Email address"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        required
                        aria-label="Password"
                    />

                    {mode === 'signup' && (
                        <input
                            type="password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={styles.input}
                            required
                            aria-label="Confirm password"
                        />
                    )}

                    {error && <div style={styles.error}>{error}</div>}

                    <button
                        type="submit"
                        style={styles.submitButton}
                        disabled={isLoading}
                    >
                        {isLoading
                            ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                            : (mode === 'signin' ? 'Sign In' : 'Create Account')
                        }
                    </button>
                </form>

                {/* Toggle Link */}
                <p style={styles.toggleText}>
                    {mode === 'signin' ? (
                        <>
                            Don&apos;t have an account?{' '}
                            <button
                                type="button"
                                onClick={() => { setMode('signup'); setError(''); }}
                                style={styles.toggleLink}
                            >
                                Sign up.
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => { setMode('signin'); setError(''); }}
                                style={styles.toggleLink}
                            >
                                Sign in.
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
    },
    logoSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '24px',
    },
    logoText: {
        fontSize: '32px',
        fontWeight: 700,
        color: '#3b82f6',
        letterSpacing: '-0.5px',
    },
    card: {
        width: '100%',
        maxWidth: '480px',
        background: 'white',
        borderRadius: '12px',
        padding: '32px 40px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    },
    title: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#1f2937',
        textAlign: 'center' as const,
        marginBottom: '24px',
    },
    googleButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 16px',
        paddingLeft: '48px',
        borderRadius: '50px',
        border: 'none',
        background: 'linear-gradient(135deg, #4285f4 0%, #357ae8 100%)',
        color: 'white',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        marginBottom: '10px',
        transition: 'transform 0.15s, box-shadow 0.15s',
        position: 'relative' as const,
    },
    githubButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 16px',
        paddingLeft: '48px',
        borderRadius: '50px',
        border: 'none',
        background: '#24292e',
        color: 'white',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        marginBottom: '20px',
        transition: 'transform 0.15s, box-shadow 0.15s',
        position: 'relative' as const,
    },
    iconWrapper: {
        position: 'absolute' as const,
        left: '6px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '32px',
        background: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    iconWrapperGithub: {
        position: 'absolute' as const,
        left: '6px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '32px',
        background: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    oauthButtonText: {
        marginLeft: '8px',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '20px',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: '#e5e7eb',
    },
    dividerText: {
        color: '#9ca3af',
        fontSize: '13px',
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        marginBottom: '12px',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxSizing: 'border-box' as const,
    },
    submitButton: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: '#3b82f6',
        color: 'white',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: '4px',
        transition: 'background 0.15s',
    },
    error: {
        padding: '10px',
        borderRadius: '8px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        fontSize: '13px',
        marginBottom: '12px',
        textAlign: 'center' as const,
    },
    toggleText: {
        textAlign: 'center' as const,
        color: '#6b7280',
        fontSize: '13px',
        marginTop: '20px',
    },
    toggleLink: {
        background: 'none',
        border: 'none',
        color: '#3b82f6',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        textDecoration: 'underline',
        padding: 0,
    },
    loadingSpinner: {
        width: '36px',
        height: '36px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
};
