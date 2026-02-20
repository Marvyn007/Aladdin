'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface ImageWithRetryProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | Blob | null;
    fallbackIcon?: React.ReactNode;
}

export function ImageWithRetry({ src, alt, className, style, fallbackIcon, ...props }: ImageWithRetryProps) {
    // If src is empty/null/undefined, skip all loading — render fallback immediately
    const [imgSrc, setImgSrc] = useState<string | null>(() => {
        if (typeof src === 'string' && src.trim()) return src;
        return null;
    });

    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset state on src change
        setHasError(false);

        if (!src || (typeof src === 'string' && !src.trim())) {
            setImgSrc(null);
            setHasError(true); // Immediately show fallback, no flicker
            return;
        }

        if (src instanceof Blob) {
            const objectUrl = URL.createObjectURL(src);
            setImgSrc(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }

        setImgSrc(src);
    }, [src]);

    // On ANY error, immediately show the fallback — no retries, no flicker
    const handleError = () => {
        setHasError(true);
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
