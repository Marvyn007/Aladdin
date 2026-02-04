'use client';

import { useSignIn } from '@clerk/nextjs';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
    const { signIn, isLoaded } = useSignIn();
    const router = useRouter();

    // Handle escape key to close
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleOAuthSignIn = useCallback(async (provider: 'oauth_google' | 'oauth_github') => {
        if (!isLoaded || !signIn) return;

        try {
            await signIn.authenticateWithRedirect({
                strategy: provider,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: window.location.href,
            });
        } catch (error) {
            console.error('OAuth sign-in error:', error);
        }
    }, [isLoaded, signIn]);

    const handleContinueWithEmail = () => {
        onClose();
        router.push('/sign-in');
    };

    if (!isOpen) return null;

    return (
        <div
            className="auth-modal-overlay"
            onClick={onClose}
        >
            <div
                className="auth-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    className="auth-modal-close"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {/* Logo */}
                <div className="auth-modal-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/aladdin-logo.png"
                        alt="Aladdin"
                    />
                </div>

                {/* Headline */}
                <h2 className="auth-modal-headline">
                    Sign in to access<br />all the content.
                </h2>

                {/* OAuth Buttons */}
                <div className="auth-modal-buttons">
                    <button
                        className="auth-modal-oauth-btn"
                        onClick={() => handleOAuthSignIn('oauth_google')}
                        disabled={!isLoaded}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <button
                        className="auth-modal-oauth-btn"
                        onClick={() => handleOAuthSignIn('oauth_github')}
                        disabled={!isLoaded}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        <span>Continue with GitHub</span>
                    </button>
                </div>

                {/* Divider */}
                <div className="auth-modal-divider">
                    <span>or</span>
                </div>

                {/* Continue with Email Button */}
                <button
                    className="auth-modal-email-btn"
                    onClick={handleContinueWithEmail}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <span>Continue with Email</span>
                </button>
            </div>

            <style jsx>{`
                .auth-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    animation: fadeIn 0.2s ease;
                    padding: 16px;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .auth-modal-card {
                    background: #ffffff;
                    border-radius: 20px;
                    padding: 36px 40px;
                    width: 100%;
                    max-width: 460px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    position: relative;
                    animation: slideUp 0.3s ease;
                }
                
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .auth-modal-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    color: #9ca3af;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                
                .auth-modal-close:hover {
                    background: #f3f4f6;
                    color: #374151;
                }
                
                .auth-modal-logo {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 20px;
                }
                
                .auth-modal-logo img {
                    width: 64px;
                    height: 64px;
                    object-fit: contain;
                }
                
                .auth-modal-headline {
                    font-size: 22px;
                    font-weight: 700;
                    color: #1f2937;
                    text-align: center;
                    margin: 0 0 28px 0;
                    line-height: 1.3;
                }
                
                .auth-modal-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .auth-modal-oauth-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    width: 100%;
                    padding: 14px 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 9999px;
                    background: #ffffff;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    color: #374151;
                    transition: all 0.2s;
                }
                
                .auth-modal-oauth-btn:hover {
                    background: #f9fafb;
                    border-color: #d1d5db;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .auth-modal-oauth-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .auth-modal-oauth-btn svg {
                    flex-shrink: 0;
                }
                
                .auth-modal-divider {
                    display: flex;
                    align-items: center;
                    margin: 20px 0;
                }
                
                .auth-modal-divider::before,
                .auth-modal-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #e5e7eb;
                }
                
                .auth-modal-divider span {
                    padding: 0 16px;
                    font-size: 13px;
                    color: #9ca3af;
                    font-weight: 500;
                }
                
                .auth-modal-email-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    width: 100%;
                    padding: 14px 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 9999px;
                    background: #ffffff;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 500;
                    color: #3b82f6;
                    transition: all 0.2s;
                }
                
                .auth-modal-email-btn:hover {
                    background: #f0f9ff;
                    border-color: #bfdbfe;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
                }
                
                .auth-modal-email-btn svg {
                    flex-shrink: 0;
                    color: #6b7280;
                }
                
                @media (max-width: 480px) {
                    .auth-modal-card {
                        margin: 0;
                        padding: 32px 24px;
                        border-radius: 16px;
                    }
                    
                    .auth-modal-headline {
                        font-size: 20px;
                    }
                    
                    .auth-modal-logo img {
                        width: 56px;
                        height: 56px;
                    }
                    
                    .auth-modal-oauth-btn,
                    .auth-modal-email-btn {
                        padding: 12px 20px;
                        font-size: 14px;
                    }
                }
            `}</style>
        </div>
    );
}
