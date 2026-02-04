import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    subMonths,
    // addMonths, 
    isSameMonth,
    startOfWeek,
    endOfWeek,
    isAfter,
    startOfDay
} from 'date-fns';
import Lenis from 'lenis';

interface ActivityGraphProps {
    activity: Record<string, number>;
    streak: number;
}

export function ActivityGraph({ activity, streak }: ActivityGraphProps) {
    // currentDate isn't really used for navigation anymore, but we anchor "today"
    const today = new Date();

    const [showTip, setShowTip] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // Ref for the scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Animation effect on mount
    useEffect(() => {
        setShowTip(false);
        setIsExiting(false);

        // "appears ... after 0.3secs"
        const timer = setTimeout(() => {
            setShowTip(true);
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    // Initialize Lenis for smooth horizontal scrolling
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Scroll to the end (Right) initially so current month is visible
        container.scrollLeft = container.scrollWidth;

        const lenis = new Lenis({
            wrapper: container,
            content: container,
            orientation: 'horizontal',
            gestureOrientation: 'horizontal',
            smoothWheel: true,
            wheelMultiplier: 1, // standard speed
        });

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
        };
    }, []);

    const handleCloseTip = () => {
        setIsExiting(true);
        setTimeout(() => {
            setShowTip(false);
            setIsExiting(false);
        }, 300);
    };

    const getMonthData = (baseDate: Date) => {
        const monthStart = startOfMonth(baseDate);
        const monthEnd = endOfMonth(baseDate);
        const start = startOfWeek(monthStart);
        const end = endOfWeek(monthEnd);

        const weeks: Date[][] = [];
        let currentWeek: Date[] = [];
        const allDays = eachDayOfInterval({ start, end });

        allDays.forEach(day => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        // Stats
        const daysInActualMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        let totalJobs = 0;
        daysInActualMonth.forEach(day => {
            if (isAfter(startOfDay(day), startOfDay(today))) return;
            const dateKey = day.toISOString().split('T')[0];
            totalJobs += (activity[dateKey] || 0);
        });

        return {
            weeks,
            stats: {
                totalJobs,
                monthName: format(baseDate, 'MMM'),
                fullMonthName: format(baseDate, 'MMMM')
            },
            date: baseDate
        };
    };

    // Generate last 12 months
    const monthsToDisplay = useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => {
            // i=0 -> Current month (subMonths(today, 0))
            // i=11 -> 11 months ago
            // We want the order to be [11 months ago, ..., current]
            return getMonthData(subMonths(today, 11 - i));
        });
    }, [activity]);

    const getColor = (count: number) => {
        if (count === 0) return '#ebedf0';
        if (count === 1) return '#E5F5E0';
        if (count === 2) return '#C7E9C0';
        if (count === 3) return '#A1D99B';
        if (count === 4) return '#74C476';
        if (count === 5) return '#41AB5D';
        if (count === 6) return '#238B45';
        if (count >= 7) return '#005A32';
        return '#ebedf0';
    };

    const getTooltip = (date: Date, count: number) => {
        const dateStr = format(date, 'MMM do, yyyy');
        const jobsStr = count === 1 ? 'job' : 'jobs';
        return `${count} ${jobsStr} applied on ${dateStr}`;
    };

    const getIsFuture = (date: Date) => isAfter(startOfDay(date), startOfDay(today));

    // Calculate total jobs for the entire displayed period (past year)
    const totalYearlyJobs = monthsToDisplay.reduce((acc, month) => acc + month.stats.totalJobs, 0);

    return (
        <div style={{
            padding: '0px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            paddingTop: '40px',
            position: 'relative'
        }}>

            <style dangerouslySetInnerHTML={{
                __html: `
            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fallDown {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(100px) rotate(10deg); opacity: 0; }
            }
            .no-scrollbar::-webkit-scrollbar {
                display: none;
            }
            .no-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        `}} />

            {/* 1. Header: Current Streak */}
            <div style={{
                marginBottom: '40px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                paddingLeft: '20px'
            }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Current Streak:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: streak > 0 ? '#41AB5D' : 'var(--text-primary)' }}>
                        {streak}
                    </span>
                    {streak > 0 && <span style={{ fontSize: '16px' }}>🔥</span>}
                </div>
            </div>

            {/* 2. Container for 12 Months - Scrollable */}
            <div
                ref={scrollContainerRef}
                className="no-scrollbar"
                style={{
                    display: 'flex',
                    gap: '40px',
                    marginBottom: '30px',
                    width: '100%',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    paddingLeft: '20px', // Start padding
                    paddingRight: '20px' // End padding (to see the last month fully)
                }}
            >
                {monthsToDisplay.map((monthData, monthIndex) => (
                    <div key={monthIndex} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        {/* Monthly Jobs Count Header */}
                        <div style={{ marginBottom: '8px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {monthData.stats.totalJobs} jobs applied
                        </div>

                        <div style={{ display: 'flex', gap: '5px' }}>
                            {monthData.weeks.map((week, weekIndex) => (
                                <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {week.map((date) => {
                                        const isFuture = getIsFuture(date);
                                        const isMonthMatch = isSameMonth(date, monthData.date);
                                        const dateKey = date.toISOString().split('T')[0];
                                        const count = activity[dateKey] || 0;
                                        const shouldShow = isMonthMatch && !isFuture;

                                        return (
                                            <div
                                                key={dateKey}
                                                title={shouldShow ? getTooltip(date, count) : undefined}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '4px',
                                                    background: shouldShow ? getColor(count) : 'transparent',
                                                    cursor: shouldShow ? 'pointer' : 'default',
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {monthData.stats.monthName}
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Summary */}
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '40px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalYearlyJobs}</span> jobs applied past year
            </div>

            {/* 4. Tip - Sticky & Animated */}
            {showTip && (
                <div style={{
                    position: 'sticky',
                    bottom: '20px',
                    zIndex: 100,
                    width: '100%',
                    marginTop: 'auto',
                    animation: isExiting ? 'fallDown 0.3s ease-in forwards' : 'slideUp 0.3s ease-out forwards',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0 16px'
                }}>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        background: 'rgba(253, 224, 71, 0.4)',
                        padding: '12px 32px 12px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(253, 224, 71, 0.2)',
                        position: 'relative',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        backdropFilter: 'blur(4px)',
                        maxWidth: '400px',
                        width: '100%'
                    }}>
                        <button
                            onClick={handleCloseTip}
                            style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <span style={{ fontWeight: 600, color: '#4F46E5' }}>Tip:</span> To track your active days, click on the <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>"Applied?"</span> button after you apply to a job.
                    </div>
                </div>
            )}

        </div>
    );
}
