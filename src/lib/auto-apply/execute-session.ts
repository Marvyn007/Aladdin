import { prisma } from '@/lib/prisma';
import Browserbase from '@browserbasehq/sdk';
import { Stagehand } from '@browserbasehq/stagehand';
import { buildProfileContext } from '@/lib/auto-apply/build-profile-context';
import { matchFieldToProfile } from '@/lib/auto-apply/match-field';
import { buildApplyPilotAgentSystemPrompt } from '@/lib/apply-pilot-profile/agent-system-prompt';
import { triggerAutoApplyEvent } from '@/lib/auto-apply/pusher-events';
import { attemptStallRecovery } from '@/lib/auto-apply/stall-recovery';
import { tryFastFillObservation } from '@/lib/auto-apply/deterministic-fill';
import { getAutoApplyStagehandEnv } from '@/lib/auto-apply/stagehand-tuning';

const MAX_PAGES = 30;

const REVIEW_PAGE_PATTERNS = /review|submit application|confirm your|verify your/i;

async function connectStagehand(
  bbSessionId: string,
  tuning: ReturnType<typeof getAutoApplyStagehandEnv>,
  systemPrompt: string
): Promise<Stagehand> {
  const sh = new Stagehand({
    env:                  'BROWSERBASE',
    apiKey:               process.env.BROWSERBASE_API_KEY!,
    projectId:            process.env.BROWSERBASE_PROJECT_ID!,
    browserbaseSessionID: bbSessionId,
    model:                { modelName: tuning.modelName, apiKey: process.env.LLM_API_KEY! },
    verbose:              0,
    selfHeal:             false,
    domSettleTimeout:     tuning.domSettleMs,
    systemPrompt,
  });
  await sh.init();
  return sh;
}

export interface ExecuteAutoApplySessionParams {
  sessionId: string;
  userId:    string;
  jobId:     string;
}

/**
 * Full Apply Pilot run: Browserbase session, live view, Stagehand fill loop, Pusher + DB updates.
 * Intended for local dev via `after()` from /api/auto-apply/start, or a single Inngest step in prod.
 *
 * Important: one Browserbase session must stay alive for the whole run. Do not call `sh.close()`
 * between navigate and fill steps — that ends the remote session and reconnecting with the same
 * id returns 400 "Requested session is not running".
 */
export async function executeAutoApplySession({
  sessionId,
  userId,
  jobId,
}: ExecuteAutoApplySessionParams): Promise<
  { status: 'awaiting_review' } | { status: 'cancelled' } | { status: 'failed'; reason: string }
> {
  const tuning = getAutoApplyStagehandEnv();

  const shouldAbort = async () => {
    const s = await prisma.autoApplySession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    return !s || s.status === 'cancelled' || s.status === 'deleted';
  };

  if (await shouldAbort()) return { status: 'cancelled' };

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
  const bbSession = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  const debug = await bb.sessions.debug(bbSession.id);
  const bbSessionId = bbSession.id;
  const liveViewUrl = debug.debuggerFullscreenUrl;

  if (await shouldAbort()) return { status: 'cancelled' };

  await prisma.autoApplySession.update({
    where: { id: sessionId },
    data:  { browserbaseSessionId: bbSessionId, liveViewUrl, status: 'running' },
  });
  await triggerAutoApplyEvent(sessionId, 'session_started', { liveViewUrl });

  if (await shouldAbort()) return { status: 'cancelled' };

  const jobRow = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      applyUrl:            true,
      sourceUrl:           true,
      title:               true,
      company:             true,
      jobDescriptionPlain: true,
      rawTextSummary:      true,
      normalizedText:      true,
    },
  });
  const url = jobRow?.applyUrl ?? jobRow?.sourceUrl ?? '';
  const description =
    jobRow?.jobDescriptionPlain?.trim() ||
    jobRow?.rawTextSummary?.trim() ||
    jobRow?.normalizedText?.trim() ||
    '';
  const jobPack = jobRow
    ? { title: jobRow.title, company: jobRow.company ?? null, description }
    : undefined;

  const profileContext = await buildProfileContext(userId, { jobPack });
  const systemPrompt = buildApplyPilotAgentSystemPrompt(profileContext);

  if (await shouldAbort()) return { status: 'cancelled' };

  const sh = await connectStagehand(bbSessionId, tuning, systemPrompt);

  try {

    {
      const page = sh.context.activePage();
      if (!page) throw new Error('No active page in Browserbase session');
      await page.goto(url, { waitUntil: tuning.navWait as 'load' | 'domcontentloaded' | 'networkidle' });
      await triggerAutoApplyEvent(sessionId, 'navigating', {});
    }

    let stallCount = 0;

    for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
      if (await shouldAbort()) return { status: 'cancelled' };

      let pageResult: {
        isReviewPage: boolean;
        advanced: boolean;
        fieldsFilled: number;
        stallReason: string | null;
      };

      try {
        const page = sh.context.activePage();
        if (!page) throw new Error('No active page');

        const currentUrl = page.url();
        const pageTitle  = await page.title();

        if (REVIEW_PAGE_PATTERNS.test(pageTitle)) {
          pageResult = { isReviewPage: true, advanced: false, fieldsFilled: 0, stallReason: null };
        } else {
          const observations = await sh.observe(
            'Find all visible input fields, text areas, dropdowns, and radio groups that need to be filled in this form.',
            { timeout: tuning.observeTimeout }
          );

          let fieldsFilled = 0;
          for (const obs of observations) {
            const label = obs.description ?? obs.method ?? '';
            const profileVal = matchFieldToProfile(
              { label, name: obs.selector ?? '' },
              profileContext
            );

            const fast = await tryFastFillObservation(page, obs, profileContext);
            if (!fast) {
              if (profileVal !== null) {
                await sh.act(`Fill the "${label}" field with "${profileVal}"`, {
                  timeout: tuning.actTimeout,
                });
              } else {
                await sh.act(
                  `Fill the "${label}" field with an appropriate value based on this resume context: ${profileContext.resumeSummary}`,
                  { timeout: tuning.actTimeout }
                );
              }
            }
            fieldsFilled++;

            await triggerAutoApplyEvent(sessionId, 'field_filled', {
              label,
              source: profileVal !== null ? 'profile' : 'ai',
            });
          }

          await sh.act(
            'Click the Next, Continue, or Save & Continue button to advance to the next step.',
            { timeout: tuning.actTimeout }
          );

          await page.waitForLoadState(
            tuning.postClickWait as 'load' | 'domcontentloaded' | 'networkidle',
            25_000
          ).catch(() => {});
          await new Promise((r) => setTimeout(r, tuning.postClickWait === 'networkidle' ? 0 : 320));

          const newUrl       = page.url();
          const newTitle     = await page.title();
          const isReviewPage = REVIEW_PAGE_PATTERNS.test(newTitle);
          const advanced     = newUrl !== currentUrl;

          pageResult = { isReviewPage, advanced, fieldsFilled, stallReason: null };
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        pageResult = { isReviewPage: false, advanced: false, fieldsFilled: 0, stallReason: reason };
      }

      await prisma.autoApplySession.update({
        where: { id: sessionId },
        data: {
          pagesVisited:      { increment: 1 },
          fieldsFilledCount: { increment: pageResult.fieldsFilled },
          lastEventAt:       new Date(),
        },
      });
      await triggerAutoApplyEvent(sessionId, 'page_advanced', { pageNumber: pageNum + 1 });

      if (pageResult.isReviewPage) break;

      if (!pageResult.advanced) {
        stallCount++;
        const page = sh.context.activePage();
        if (!page) {
          await prisma.autoApplySession.update({
            where: { id: sessionId },
            data:  { status: 'failed', errorMessage: 'No active page during stall recovery' },
          });
          await triggerAutoApplyEvent(sessionId, 'failed', { reason: 'No active page during stall recovery' });
          return { status: 'failed', reason: 'No active page during stall recovery' };
        }
        const recoveryResult = await attemptStallRecovery(page, stallCount);

        await triggerAutoApplyEvent(sessionId, 'stalled', {
          reason:  recoveryResult.reason,
          attempt: stallCount,
        });

        if (recoveryResult.recovered) {
          // Recovered — try another pass; reset streak so we don't false-fail on
          // `stallCount > 2` after a *successful* recovery (that used to emit `failed`
          // with messages like "Fields appeared after waiting for JS render").
          stallCount = 0;
        } else if (stallCount > 2) {
          await prisma.autoApplySession.update({
            where: { id: sessionId },
            data:  { status: 'failed', errorMessage: recoveryResult.reason },
          });
          await triggerAutoApplyEvent(sessionId, 'failed', { reason: recoveryResult.reason });
          return { status: 'failed', reason: recoveryResult.reason };
        }
      } else {
        stallCount = 0;
      }
    }

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

    return { status: 'awaiting_review' };
  } finally {
    await sh.close();
  }
}
