// src/inngest/auto-apply.ts
import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';
import Browserbase from '@browserbasehq/sdk';
import { Stagehand } from '@browserbasehq/stagehand';
import { buildProfileContext } from '@/lib/auto-apply/build-profile-context';
import { matchFieldToProfile } from '@/lib/auto-apply/match-field';
import { triggerAutoApplyEvent } from '@/lib/auto-apply/pusher-events';
import { attemptStallRecovery } from '@/lib/auto-apply/stall-recovery';

const MAX_PAGES = 30;

// Patterns that indicate we've reached a review/confirm page
const REVIEW_PAGE_PATTERNS = /review|submit application|confirm your|verify your/i;

async function connectStagehand(bbSessionId: string): Promise<Stagehand> {
  const sh = new Stagehand({
    env: 'BROWSERBASE',
    apiKey:               process.env.BROWSERBASE_API_KEY!,
    projectId:            process.env.BROWSERBASE_PROJECT_ID!,
    browserbaseSessionID: bbSessionId,
    modelName:            'gpt-4o-mini',
    modelClientOptions:   { apiKey: process.env.LLM_API_KEY! },
    verbose:              1,
    headless:             false, // headed required for live view
  });
  await sh.init();
  return sh;
}

export const runAutoApplySession = inngest.createFunction(
  {
    id:          'auto-apply-session',
    retries:     2,
    concurrency: { limit: 5 },
  },
  { event: 'autoapply/session.start' },
  async ({ event, step }) => {
    const { sessionId, userId, jobId } = event.data as {
      sessionId: string;
      userId:    string;
      jobId:     string;
    };

    // ── Step 1: Create Browserbase session, get live view URL ────────────
    const { bbSessionId, liveViewUrl } = await step.run('init-browserbase', async () => {
      const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
      const bbSession = await bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
      });
      const debug = await bb.sessions.debug(bbSession.id);
      return {
        bbSessionId:  bbSession.id,
        liveViewUrl:  debug.debuggerFullscreenUrl,
      };
    });

    // ── Step 2: Persist BB session info + notify frontend ────────────────
    await step.run('save-session-info', async () => {
      await prisma.autoApplySession.update({
        where: { id: sessionId },
        data:  { browserbaseSessionId: bbSessionId, liveViewUrl, status: 'running' },
      });
      await triggerAutoApplyEvent(sessionId, 'session_started', { liveViewUrl });
    });

    // ── Step 3: Build serializable profile context ────────────────────────
    const profileContext = await step.run('build-context', async () => {
      return buildProfileContext(userId);
    });

    // ── Step 4: Navigate to the job apply URL ─────────────────────────────
    await step.run('navigate-to-job', async () => {
      const job = await prisma.job.findUnique({
        where:  { id: jobId },
        select: { applyUrl: true, sourceUrl: true },
      });
      const url = job?.applyUrl ?? job?.sourceUrl ?? '';

      const sh = await connectStagehand(bbSessionId);
      try {
        await sh.page.goto(url, { waitUntil: 'networkidle' });
        await triggerAutoApplyEvent(sessionId, 'navigating', {});
      } finally {
        await sh.close();
      }
    });

    // ── Steps 5+: Page filling loop ───────────────────────────────────────
    let stallCount = 0;

    for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
      // Fill all fields on this page and advance
      const pageResult = await step.run(`fill-page-${pageNum}`, async () => {
        const sh = await connectStagehand(bbSessionId);
        try {
          const currentUrl = sh.page.url();
          const pageTitle  = await sh.page.title();

          // Check if we landed on review page before filling anything
          if (REVIEW_PAGE_PATTERNS.test(pageTitle)) {
            return { isReviewPage: true, advanced: false, fieldsFilled: 0, stallReason: null };
          }

          // Observe all interactive fields
          const observations = await sh.page.observe({
            instruction: 'Find all visible input fields, text areas, dropdowns, and radio groups that need to be filled in this form.',
          });

          let fieldsFilled = 0;
          for (const obs of observations) {
            const profileVal = matchFieldToProfile(
              { label: obs.description, name: obs.selector },
              profileContext
            );

            if (profileVal !== null) {
              await sh.act({ action: `Fill the "${obs.description}" field with "${profileVal}"` });
            } else {
              await sh.act({
                action: `Fill the "${obs.description}" field with an appropriate value based on this resume context: ${profileContext.resumeSummary}`,
              });
            }
            fieldsFilled++;

            await triggerAutoApplyEvent(sessionId, 'field_filled', {
              label:  obs.description,
              source: profileVal !== null ? 'profile' : 'ai',
            });
          }

          // Click the advance button
          await sh.act({
            action: 'Click the Next, Continue, or Save & Continue button to advance to the next step.',
          });

          // Wait for the new page to fully load — prevents false stalls on SPA ATSes
          await sh.page.waitForLoadState('networkidle');

          const newUrl      = sh.page.url();
          const newTitle    = await sh.page.title();
          const isReviewPage = REVIEW_PAGE_PATTERNS.test(newTitle);
          const advanced     = newUrl !== currentUrl;

          return { isReviewPage, advanced, fieldsFilled, stallReason: null };
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          return { isReviewPage: false, advanced: false, fieldsFilled: 0, stallReason: reason };
        } finally {
          await sh.close();
        }
      });

      // Update DB counters and notify frontend
      await step.run(`update-progress-${pageNum}`, async () => {
        await prisma.autoApplySession.update({
          where: { id: sessionId },
          data: {
            pagesVisited:      { increment: 1 },
            fieldsFilledCount: { increment: pageResult.fieldsFilled },
            lastEventAt:       new Date(),
          },
        });
        await triggerAutoApplyEvent(sessionId, 'page_advanced', { pageNumber: pageNum + 1 });
      });

      if (pageResult.isReviewPage) break;

      // Stall handling
      if (!pageResult.advanced) {
        stallCount++;
        const recoveryResult = await step.run(`stall-recovery-${pageNum}`, async () => {
          const sh = await connectStagehand(bbSessionId);
          try {
            return await attemptStallRecovery(sh.page, stallCount);
          } finally {
            await sh.close();
          }
        });

        await triggerAutoApplyEvent(sessionId, 'stalled', {
          reason:  recoveryResult.reason,
          attempt: stallCount,
        });

        if (!recoveryResult.recovered || stallCount > 2) {
          await step.run('mark-failed', async () => {
            await prisma.autoApplySession.update({
              where: { id: sessionId },
              data:  { status: 'failed', errorMessage: recoveryResult.reason },
            });
            await triggerAutoApplyEvent(sessionId, 'failed', { reason: recoveryResult.reason });
          });
          return { status: 'failed', reason: recoveryResult.reason };
        }
      } else {
        stallCount = 0; // reset on successful advance
      }
    }

    // ── Final step: signal review page is ready for the user ─────────────
    await step.run('await-review', async () => {
      const current = await prisma.autoApplySession.findUnique({
        where:  { id: sessionId },
        select: { pagesVisited: true, fieldsFilledCount: true },
      });
      await prisma.autoApplySession.update({
        where: { id: sessionId },
        data:  { status: 'awaiting_review' },
      });
      await triggerAutoApplyEvent(sessionId, 'awaiting_review', {
        pagesVisited:      current?.pagesVisited      ?? 0,
        fieldsFilledCount: current?.fieldsFilledCount ?? 0,
      });
    });

    return { status: 'awaiting_review' };
  }
);
