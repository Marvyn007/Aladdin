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
    if (!normalizedLogoUrl) return null;

    return (
        <div style={{ width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
                src={normalizedLogoUrl}
                alt={companyName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }}
                referrerPolicy="no-referrer"
                loading="lazy"
            />
        </div>
    );
}
