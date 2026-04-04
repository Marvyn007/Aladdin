'use client';

import React from 'react';

interface CompanyLogoProps {
    companyName: string;
    logoUrl?: string | null;
    size?: number;
    className?: string;
}

export function CompanyLogo({ companyName, logoUrl, size = 32, className = '' }: CompanyLogoProps) {
    const normalizedLogoUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    
    // Determine the actual src to use
    let finalSrc = '/default company icon.png';
    if (normalizedLogoUrl) {
        if (normalizedLogoUrl.startsWith('http') && 
            !normalizedLogoUrl.includes('logo.dev') && 
            !normalizedLogoUrl.includes('ui-avatars.com')) {
            // Proxy external unpredictable images
            finalSrc = `/api/proxy-image?url=${encodeURIComponent(normalizedLogoUrl)}`;
        } else {
            finalSrc = normalizedLogoUrl;
        }
    }

    return (
        <div style={{ width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
                src={finalSrc}
                alt={companyName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                referrerPolicy="no-referrer"
                loading="lazy"
            />
        </div>
    );
}
