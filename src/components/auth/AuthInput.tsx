'use client';

import { forwardRef } from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
    ({ label, error, id, className = '', ...props }, ref) => {
        const inputId = id || props.name;

        return (
            <div className="auth-input-wrapper">
                {label && (
                    <label htmlFor={inputId} className="auth-input-label">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={`auth-input ${error ? 'auth-input-error' : ''} ${className}`}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    {...props}
                />
                {error && (
                    <span id={`${inputId}-error`} className="auth-input-error-text" role="alert">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);

AuthInput.displayName = 'AuthInput';
