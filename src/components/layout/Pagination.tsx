import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const isFirst = currentPage === 1;
    const isLast = currentPage === totalPages;

    const btnStyle = (disabled: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 14px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        opacity: disabled ? 0.4 : 1,
    });

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '16px 0',
            marginTop: '16px',
            width: '100%',
            gap: '12px',
        }}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={isFirst}
                style={btnStyle(isFirst)}
            >
                <ChevronLeft size={16} />
                Previous
            </button>

            <span style={{
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                userSelect: 'none',
            }}>
                Page {currentPage} of {totalPages}
            </span>

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={isLast}
                style={btnStyle(isLast)}
            >
                Next
                <ChevronRight size={16} />
            </button>
        </div>
    );
}
