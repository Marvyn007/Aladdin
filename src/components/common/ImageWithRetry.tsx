'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface ImageWithRetryProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | Blob | null;
    fallbackIcon?: React.ReactNode;
}

export function ImageWithRetry({ src, alt, className, style, fallbackIcon, ...props }: ImageWithRetryProps) {
    // Fix: Handle Blob in initial state safely
    const [imgSrc, setImgSrc] = useState<string | null>(() => {
        if (typeof src === 'string') return src;
        // Blob or null -> utilize useEffect to generate object URL if needed
        return null;
    });

    const [retryCount, setRetryCount] = useState(0);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset state on src change
        setHasError(false);
        setRetryCount(0);

        if (!src) {
            setImgSrc(null);
            return;
        }

        if (src instanceof Blob) {
            const objectUrl = URL.createObjectURL(src);
            setImgSrc(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }

        setImgSrc(src);
    }, [src]);

    const handleError = () => {
        // console.log(`Image load error for ${src}. Retry count: ${retryCount}`);
        if (retryCount < 5) {
            const nextRetry = retryCount + 1;
            setRetryCount(nextRetry);

            // Only retry if it's a string URL (can't really retry a Blob)
            if (typeof src === 'string') {
                setTimeout(() => {
                    // Try to re-fetch by appending a cache buster
                    const separator = src.includes('?') ? '&' : '?';
                    setImgSrc(`${src}${separator}retry=${nextRetry}-${Date.now()}`);
                }, 1000 * nextRetry);
            } else {
                setHasError(true);
            }
        } else {
            // console.log(`Max retries reached. Showing fallback.`);
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
