// src/inngest/auto-apply.ts
import { inngest } from '@/lib/inngest';
import { executeAutoApplySession } from '@/lib/auto-apply/execute-session';

export const runAutoApplySession = inngest.createFunction(
  {
    id:          'auto-apply-session',
    retries:     2,
    concurrency: { limit: 5 },
    triggers:    [{ event: 'autoapply/session.start' }],
  },
  async ({ event, step }: { event: { data: { sessionId: string; userId: string; jobId: string } }; step: { run: (n: string, fn: () => Promise<unknown>) => Promise<unknown> } }) => {
    const { sessionId, userId, jobId } = event.data;
    return step.run('execute-auto-apply', () =>
      executeAutoApplySession({ sessionId, userId, jobId })
    );
  }
);
