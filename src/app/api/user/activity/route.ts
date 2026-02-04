
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma as db } from '@/lib/prisma';
import { startOfDay, subDays, format, differenceInCalendarDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all applications for the user, selecting only appliedAt
        const applications = await db.application.findMany({
            where: {
                userId: userId,
            },
            select: {
                appliedAt: true,
            },
            orderBy: {
                appliedAt: 'asc',
            },
        });

        // Group by date (GMT)
        const activityMap: Record<string, number> = {};
        const appliedDates = new Set<string>();

        applications.forEach((app) => {
            if (!app.appliedAt) return;

            // Use GMT/UTC for date bucketing as requested
            const dateKey = app.appliedAt.toISOString().split('T')[0]; // YYYY-MM-DD

            activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
            appliedDates.add(dateKey);
        });

        // Calculate Streak
        // Streak: Consecutive days ending today or yesterday (to allow keeping streak alive today)
        // We strictly use GMT dates
        const now = new Date();
        const todayGMT = now.toISOString().split('T')[0];

        // Check if applied today
        let currentStreak = 0;

        // We check backwards from today
        let checkDateString = todayGMT;

        // If not applied today, check if applied yesterday to maintain streak
        if (!appliedDates.has(checkDateString)) {
            const yesterday = new Date(now);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayGMT = yesterday.toISOString().split('T')[0];

            if (appliedDates.has(yesterdayGMT)) {
                checkDateString = yesterdayGMT;
            } else {
                // Streak broken or 0
                checkDateString = null as any;
            }
        }

        if (checkDateString) {
            // Iterate backwards
            let d = new Date(checkDateString);
            while (true) {
                const dateStr = d.toISOString().split('T')[0];
                if (appliedDates.has(dateStr)) {
                    currentStreak++;
                    // Go back one day
                    d.setUTCDate(d.getUTCDate() - 1);
                } else {
                    break;
                }
            }
        }

        return NextResponse.json({
            activity: activityMap,
            streak: currentStreak,
            today: todayGMT // helpful for debugging or frontend alignment
        });

    } catch (error) {
        console.error('Error fetching activity:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
