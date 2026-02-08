import { NextRequest, NextResponse } from 'next/server';
import { getDbType } from '@/lib/db';
import { getPostgresPool } from '@/lib/postgres';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { targetUserId, voteType } = await req.json();

        if (!targetUserId || !voteType) {
            return NextResponse.json({ error: 'Missing targetUserId or voteType' }, { status: 400 });
        }

        if (userId === targetUserId) {
            return NextResponse.json({ error: 'Cannot vote for yourself' }, { status: 403 });
        }

        const voteValue = voteType === 'up' ? 1 : -1;

        const dbType = getDbType();
        if (dbType !== 'postgres') {
            return NextResponse.json({ error: 'Voting only supported on Postgres' }, { status: 501 });
        }

        const pool = getPostgresPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Check existing vote
            const existingRes = await client.query(
                `SELECT id, value FROM user_reputation_votes WHERE voter_id = $1 AND target_user_id = $2`,
                [userId, targetUserId]
            );

            const existingVote = existingRes.rows[0];

            let finalUserVote = voteType;

            if (existingVote) {
                // If same vote, DELETE it (toggle off/cancel)
                if (existingVote.value === voteValue) {
                    await client.query('DELETE FROM user_reputation_votes WHERE id = $1', [existingVote.id]);
                    finalUserVote = null;
                } else {
                    // If different vote, UPDATE it (flip)
                    await client.query(
                        `UPDATE user_reputation_votes SET value = $1, created_at = NOW() WHERE id = $2`,
                        [voteValue, existingVote.id]
                    );
                }
            } else {
                // Insert new vote
                await client.query(
                    `INSERT INTO user_reputation_votes (id, voter_id, target_user_id, value) VALUES (gen_random_uuid(), $1, $2, $3)`,
                    [userId, targetUserId, voteValue]
                );
            }

            // 2. Recalculate total votes (Aggregated from valid votes)
            const sumRes = await client.query(
                `SELECT COALESCE(SUM(value), 0) as total FROM user_reputation_votes WHERE target_user_id = $1`,
                [targetUserId]
            );
            const newTotal = parseInt(sumRes.rows[0].total, 10);

            // 3. Update User cache
            await client.query(`UPDATE users SET votes = $1 WHERE id = $2`, [newTotal, targetUserId]);

            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                votes: newTotal,
                userVote: finalUserVote
            });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Vote Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { userId: currentUserId } = await auth();
        const { searchParams } = new URL(req.url);
        const targetUserId = searchParams.get('userId');

        if (!targetUserId) {
            return NextResponse.json({ error: 'Missing userId param' }, { status: 400 });
        }

        const dbType = getDbType();
        if (dbType !== 'postgres') {
            return NextResponse.json({ votes: 0, userVote: null });
        }

        const pool = getPostgresPool();

        // Parallel fetch: Total votes & Current User's vote
        const queries = [
            pool.query(`SELECT votes FROM users WHERE id = $1`, [targetUserId])
        ];

        if (currentUserId) {
            queries.push(
                pool.query(
                    `SELECT value FROM user_reputation_votes WHERE voter_id = $1 AND target_user_id = $2`,
                    [currentUserId, targetUserId]
                )
            );
        }

        const results = await Promise.all(queries);
        const votes = results[0].rows[0]?.votes || 0;
        const userVoteRaw = currentUserId ? results[1].rows[0]?.value : null;

        let userVote: 'up' | 'down' | null = null;
        if (userVoteRaw === 1) userVote = 'up';
        if (userVoteRaw === -1) userVote = 'down';

        return NextResponse.json({ votes, userVote });

    } catch (error) {
        console.error('Get Vote Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
