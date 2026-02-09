'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface ImageWithRetryProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallbackIcon?: React.ReactNode;
}

export function ImageWithRetry({ src, alt, className, style, fallbackIcon, ...props }: ImageWithRetryProps) {
    const [imgSrc, setImgSrc] = useState<string | null>(src || null);
    const [retryCount, setRetryCount] = useState(0);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setImgSrc(src || null);
        setRetryCount(0);
        setHasError(false);
    }, [src]);

    const handleError = () => {
        console.log(`Image load error for ${src}. Retry count: ${retryCount}`);
        if (retryCount < 5) {
            const nextRetry = retryCount + 1;
            setRetryCount(nextRetry);

            // Exponential backoff or simple delay
            setTimeout(() => {
                if (src) {
                    // Try to re-fetch by appending a cache buster
                    const separator = src.includes('?') ? '&' : '?';
                    setImgSrc(`${src}${separator}retry=${nextRetry}-${Date.now()}`);
                }
            }, 1000 * nextRetry); // Wait 1s, 2s, 3s etc.
        } else {
            console.log(`Max retries reached for ${src}. Showing fallback.`);
            setHasError(true);
        }
    };

    if (hasError || !imgSrc) {
        return (
            <div
                className={className}
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--surface-hover)', // Light gray background
                    color: 'var(--text-tertiary)',   // Tertiary text color for icon
                    overflow: 'hidden'
                }}
                role="img"
                aria-label={alt || "User"}
            >
                {fallbackIcon || <User size="60%" />}
            </div>
        );
    }

    return (
        <img
            {...props}
            src={imgSrc}
            alt={alt}
            className={className}
            style={style}
            onError={handleError}
        />
    );
}
