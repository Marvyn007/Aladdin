'use client';

import { useSignIn, useSignUp, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function SignInContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = searchParams.get('mode');

    const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
    const { signIn, isLoaded: isSignInLoaded } = useSignIn();
    const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

    useEffect(() => {
        if (isAuthLoaded && isSignedIn) {
            router.replace('/');
        }
    }, [isAuthLoaded, isSignedIn, router]);

    // If signed in, render nothing or a loading state while redirecting
    if (isAuthLoaded && isSignedIn) {
        return null;
    }

    const [view, setView] = useState<'sign-in' | 'sign-up' | 'verify'>(mode === 'signup' ? 'sign-up' : 'sign-in');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);

    const isLoaded = isSignInLoaded && isSignUpLoaded;

    const handleOAuthSignIn = useCallback(async (provider: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded || !signIn) return;

        try {
            await signIn.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/',
            });
        } catch (error) {
            console.error('OAuth sign-in error:', error);
        }
    }, [isLoaded, signIn]);

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;

        setIsLoading(true);
        setError('');

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                window.location.href = '/';
            }
        } catch (err: unknown) {
            const error = err as { errors?: { message: string }[] };
            setError(error.errors?.[0]?.message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signUp) return;

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await signUp.create({
                emailAddress: email,
                password,
                firstName,
                lastName,
            });

            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setView('verify');
        } catch (err: unknown) {
            const error = err as { errors?: { message: string }[] };
            setError(error.errors?.[0]?.message || 'Failed to sign up');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerificationCodeChange = (index: number, value: string) => {
        // Handle paste
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newCode = [...verificationCode];
            digits.forEach((digit, i) => {
                if (index + i < 6) {
                    newCode[index + i] = digit;
                }
            });
            setVerificationCode(newCode);

            const nextEmptyIndex = newCode.findIndex(d => d === '');
            const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
            const nextInput = document.getElementById(`verification-code-${focusIndex}`);
            nextInput?.focus();

            if (newCode.every(d => d !== '')) {
                handleVerifyEmail(newCode.join(''));
            }
            return;
        }

        const newCode = [...verificationCode];
        newCode[index] = value.replace(/\D/g, '');
        setVerificationCode(newCode);

        if (value && index < 5) {
            const nextInput = document.getElementById(`verification-code-${index + 1}`);
            nextInput?.focus();
        }

        if (newCode.every(d => d !== '')) {
            handleVerifyEmail(newCode.join(''));
        }
    };

    const handleVerificationCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`verification-code-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleVerifyEmail = async (code?: string) => {
        if (!isLoaded || !signUp) return;

        setIsLoading(true);
        setError('');

        const verifyCode = code || verificationCode.join('');

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verifyCode,
            });

            if (result.status === 'complete') {
                window.location.href = '/';
            }
        } catch (err: unknown) {
            const error = err as { errors?: { message: string }[] };
            setError(error.errors?.[0]?.message || 'Invalid verification code');
            setVerificationCode(['', '', '', '', '', '']);
            document.getElementById('verification-code-0')?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setConfirmPassword('');
        setError('');
        setVerificationCode(['', '', '', '', '', '']);
    };

    const switchView = (newView: 'sign-in' | 'sign-up') => {
        resetForm();
        setView(newView);
    };

    return (
        <div className="signin-page">
            <div className="signin-card">
                {/* Logo and Brand */}
                <div className="signin-header">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/aladdin-logo.png"
                        alt="Aladdin"
                        className="signin-logo"
                    />
                    <span className="signin-brand">Aladdin</span>
                </div>

                {view === 'verify' ? (
                    <>
                        <h2 className="signin-title">Verify your email</h2>
                        <p className="signin-subtitle">
                            We sent a verification code to<br />
                            <strong>{email}</strong>
                        </p>

                        {error && (
                            <div className="signin-error">{error}</div>
                        )}

                        <div className="verification-code-container">
                            {verificationCode.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`verification-code-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={digit}
                                    onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                                    onKeyDown={(e) => handleVerificationCodeKeyDown(index, e)}
                                    className="verification-code-input"
                                    disabled={isLoading}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>

                        {isLoading && (
                            <div className="signin-loading">
                                <div className="signin-spinner" />
                                <span>Verifying...</span>
                            </div>
                        )}

                        <button
                            className="signin-back-btn"
                            onClick={() => {
                                setView('sign-up');
                                setVerificationCode(['', '', '', '', '', '']);
                            }}
                            type="button"
                        >
                            ← Back to sign up
                        </button>
                    </>
                ) : (
                    <>
                        {/* Title */}
                        <h2 className="signin-title">
                            {view === 'sign-in' ? 'Sign in to your account' : 'Create your account'}
                        </h2>

                        {/* OAuth Buttons */}
                        <div className="signin-oauth-buttons">
                            <button
                                className="signin-oauth-btn google"
                                onClick={() => handleOAuthSignIn('oauth_google')}
                                disabled={!isLoaded}
                            >
                                <div className="oauth-icon-wrapper">
                                    <svg width="18" height="18" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <span className="oauth-btn-text">Continue with Google</span>
                            </button>

                            <button
                                className="signin-oauth-btn github"
                                onClick={() => handleOAuthSignIn('oauth_github')}
                                disabled={!isLoaded}
                            >
                                <div className="oauth-icon-wrapper">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/github-icon.png" alt="GitHub" width="18" height="18" />
                                </div>
                                <span className="oauth-btn-text">Continue with GitHub</span>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="signin-divider">
                            <span>or</span>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="signin-error">{error}</div>
                        )}

                        {/* Sign In Form */}
                        {view === 'sign-in' && (
                            <form onSubmit={handleEmailSignIn} className="signin-form">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="signin-input"
                                    required
                                    disabled={isLoading}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="signin-input"
                                    required
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    className="signin-submit-btn"
                                    disabled={isLoading || !isLoaded}
                                >
                                    {isLoading ? 'Signing in...' : 'Sign In'}
                                </button>
                            </form>
                        )}

                        {/* Sign Up Form */}
                        {view === 'sign-up' && (
                            <form onSubmit={handleEmailSignUp} className="signin-form">
                                <div className="signin-name-row">
                                    <input
                                        type="text"
                                        placeholder="First Name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="signin-input"
                                        required
                                        disabled={isLoading}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Last Name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="signin-input"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="signin-input"
                                    required
                                    disabled={isLoading}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="signin-input"
                                    required
                                    disabled={isLoading}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="signin-input"
                                    required
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    className="signin-submit-btn"
                                    disabled={isLoading || !isLoaded}
                                >
                                    {isLoading ? 'Creating account...' : 'Sign Up'}
                                </button>
                            </form>
                        )}

                        {/* Toggle between Sign In and Sign Up */}
                        <p className="signin-toggle">
                            {view === 'sign-in' ? (
                                <>
                                    Don&apos;t have an account?{' '}
                                    <button onClick={() => switchView('sign-up')} type="button">
                                        Sign up.
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <button onClick={() => switchView('sign-in')} type="button">
                                        Sign in.
                                    </button>
                                </>
                            )}
                        </p>
                    </>
                )}
            </div>

            <style jsx>{`
                .signin-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
                    padding: 20px;
                }
                
                .signin-card {
                    background: #ffffff;
                    border-radius: 20px;
                    padding: 28px 32px;
                    width: 100%;
                    max-width: 480px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
                }
                
                .signin-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                
                .signin-logo {
                    width: 48px;
                    height: 48px;
                    object-fit: contain;
                }
                
                .signin-brand {
                    font-size: 32px;
                    font-weight: 700;
                    color: #3b82f6;
                }
                
                .signin-title {
                    font-size: 16px;
                    font-weight: 500;
                    color: #374151;
                    text-align: center;
                    margin: 0 0 16px 0;
                }
                
                .signin-subtitle {
                    font-size: 14px;
                    color: #6b7280;
                    text-align: center;
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                }
                
                .signin-subtitle strong {
                    color: #374151;
                }
                
                .signin-oauth-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .signin-oauth-btn {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    position: relative;
                    width: 100%;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 9999px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                
                .oauth-btn-text {
                    position: absolute;
                    left: 0;
                    right: 0;
                    text-align: center;
                }
                
                .signin-oauth-btn.google {
                    background: linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 75%, #EA4335 100%);
                    background-size: 300% 300%;
                    animation: gradient-shift 8s ease infinite;
                    color: white;
                }
                
                .signin-oauth-btn.google {
                    background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
                    color: white;
                }
                
                .signin-oauth-btn.github {
                    background: #24292e;
                    color: white;
                }
                
                .signin-oauth-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                
                .signin-oauth-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                
                .oauth-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 26px;
                    height: 26px;
                    background: white;
                    border-radius: 50%;
                    flex-shrink: 0;
                    position: relative;
                    z-index: 1;
                }
                
                .oauth-icon-wrapper img {
                    width: 18px;
                    height: 18px;
                    object-fit: contain;
                }
                
                .signin-divider {
                    display: flex;
                    align-items: center;
                    margin: 14px 0;
                }
                
                .signin-divider::before,
                .signin-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #e5e7eb;
                }
                
                .signin-divider span {
                    padding: 0 16px;
                    font-size: 13px;
                    color: #9ca3af;
                }
                
                .signin-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .signin-name-row {
                    display: flex;
                    gap: 8px;
                }
                
                .signin-name-row .signin-input {
                    flex: 1;
                    min-width: 0;
                }
                
                .signin-input {
                    width: 100%;
                    padding: 9px 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 14px;
                    color: #1f2937;
                    background: #ffffff;
                    transition: all 0.2s;
                }
                
                .signin-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .signin-input::placeholder {
                    color: #9ca3af;
                }
                
                .signin-input:disabled {
                    background: #f9fafb;
                    cursor: not-allowed;
                }
                
                .signin-submit-btn {
                    width: 100%;
                    padding: 9px 18px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 4px;
                }
                
                .signin-submit-btn:hover:not(:disabled) {
                    background: #2563eb;
                }
                
                .signin-submit-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .signin-error {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #dc2626;
                    padding: 12px 16px;
                    border-radius: 10px;
                    font-size: 14px;
                    text-align: center;
                    margin-bottom: 12px;
                }
                
                .signin-toggle {
                    text-align: center;
                    font-size: 13px;
                    color: #6b7280;
                    margin-top: 14px;
                }
                
                .signin-toggle button {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0;
                    font-size: 14px;
                }
                
                .signin-toggle button:hover {
                    text-decoration: underline;
                }
                
                .verification-code-container {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 24px;
                }
                
                .verification-code-input {
                    width: 48px;
                    height: 56px;
                    text-align: center;
                    font-size: 24px;
                    font-weight: 600;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    background: #ffffff;
                    color: #1f2937;
                    transition: all 0.2s;
                }
                
                .verification-code-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .verification-code-input:disabled {
                    background: #f9fafb;
                    cursor: not-allowed;
                }
                
                .signin-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    color: #6b7280;
                    font-size: 14px;
                    margin-bottom: 16px;
                }
                
                .signin-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #e5e7eb;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .signin-back-btn {
                    background: none;
                    border: none;
                    color: #6b7280;
                    font-size: 14px;
                    cursor: pointer;
                    padding: 8px;
                    margin: 0 auto;
                    display: block;
                }
                
                .signin-back-btn:hover {
                    color: #374151;
                }
                
                @media (max-width: 480px) {
                    .signin-card {
                        padding: 32px 24px;
                        border-radius: 20px;
                    }
                    
                    .signin-brand {
                        font-size: 28px;
                    }
                    
                    .signin-logo {
                        width: 40px;
                        height: 40px;
                    }
                    
                    .signin-title {
                        font-size: 16px;
                    }
                    
                    .signin-oauth-btn {
                        padding: 10px 16px;
                        font-size: 14px;
                    }
                    
                    .oauth-icon-wrapper {
                        width: 28px;
                        height: 28px;
                    }
                    
                    .signin-input {
                        padding: 12px 14px;
                        font-size: 14px;
                    }
                    
                    .signin-submit-btn {
                        padding: 12px 20px;
                        font-size: 14px;
                    }
                    
                    .signin-name-row {
                        flex-direction: column;
                    }
                    
                    .verification-code-input {
                        width: 42px;
                        height: 50px;
                        font-size: 20px;
                    }
                    
                    .verification-code-container {
                        gap: 6px;
                    }
                }
                
                @media (max-width: 360px) {
                    .signin-card {
                        padding: 24px 16px;
                    }
                    
                    .verification-code-input {
                        width: 38px;
                        height: 46px;
                        font-size: 18px;
                    }
                    
                    .verification-code-container {
                        gap: 4px;
                    }
                }
            `}</style>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e5e7eb',
                    borderTop: '3px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
            </div>
        }>
            <SignInContent />
        </Suspense>
    );
}
