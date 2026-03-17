'use client';

import React, { useState, useEffect } from 'react';

interface CompanyLogoProps {
    companyName: string;
    logoUrl?: string | null;
    size?: number;
    className?: string;
}

export function CompanyLogo({ companyName, logoUrl, size = 32, className = '' }: CompanyLogoProps) {
    const [imgSrc, setImgSrc] = useState<string | null>(logoUrl || null);
    const [useFallback, setUseFallback] = useState(false);

    useEffect(() => {
        setImgSrc(logoUrl || null);
        setUseFallback(false);
    }, [logoUrl, companyName]);

    // Construct Google Favicon URL as a backup/primary if logoUrl is missing
    const getGoogleFaviconUrl = (name: string) => {
        const domain = name.toLowerCase().replace(/\s+/g, '') + '.com';
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    };

    const handleImageError = () => {
        if (imgSrc && imgSrc !== getGoogleFaviconUrl(companyName)) {
            // Try Google Favicon as second attempt
            setImgSrc(getGoogleFaviconUrl(companyName));
        } else {
            // Give up and show initial fallback
            setUseFallback(true);
        }
    };

    if (useFallback || (!imgSrc && !companyName)) {
        return (
            <div 
                className={`logo-fallback ${className}`}
                style={{ 
                    width: `${size}px`, 
                    height: `${size}px`, 
                    borderRadius: '25%', 
                    background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: `${size / 2.5}px`
                }}
            >
                {companyName ? companyName.charAt(0).toUpperCase() : '?'}
            </div>
        );
    }

    const finalSrc = imgSrc || getGoogleFaviconUrl(companyName);

    return (
        <div style={{ width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
                src={finalSrc} 
                alt={companyName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                onError={handleImageError}
            />
        </div>
    );
}
