import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, limit, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    // Generate page numbers
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        // Same logic as before for calculating which pages to show
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push(-1);
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push(-1);
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push(-1);
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push(-1);
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center', // Centered
            alignItems: 'center',
            padding: '16px 0',
            marginTop: '16px',
            width: '100%',
            gap: '16px' // Gap between controls
        }}>

            {/* Previous Button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                }}
            >
                <ChevronLeft size={16} />
                Previous
            </button>

            {/* Page Numbers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getPageNumbers().map((page, idx) => (
                    page === -1 ? (
                        <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-tertiary)' }}>...</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%', // Circular
                                border: 'none',
                                background: page === currentPage ? 'var(--accent)' : 'transparent', // Filled if active
                                color: page === currentPage ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '14px',
                                fontWeight: page === currentPage ? 600 : 400,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s, color 0.2s',
                            }}
                        >
                            {page}
                        </button>
                    )
                ))}
            </div>

            {/* Next Button */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                }}
            >
                Next
                <ChevronRight size={16} />
            </button>
        </div>
    );
}
