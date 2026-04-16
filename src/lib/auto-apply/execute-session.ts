import { prisma } from '@/lib/prisma';
import Browserbase from '@browserbasehq/sdk';
import { Stagehand } from '@browserbasehq/stagehand';
import { buildProfileContext } from '@/lib/auto-apply/build-profile-context';
import { matchFieldToProfile, type ProfileContext } from '@/lib/auto-apply/match-field';
import { buildApplyPilotAgentSystemPrompt } from '@/lib/apply-pilot-profile/agent-system-prompt';
import { triggerAutoApplyEvent } from '@/lib/auto-apply/pusher-events';
import { attemptStallRecovery } from '@/lib/auto-apply/stall-recovery';
import { tryFastFillObservation } from '@/lib/auto-apply/deterministic-fill';
import { fillSmartDropdown, fuzzyMatchOption } from '@/lib/auto-apply/smart-dropdown';
import { fillNativeSelect, inferAnswerFromContext } from '@/lib/auto-apply/native-select-fill';
import { runPreFlightAudit, type FilledFieldEntry } from '@/lib/auto-apply/preflight-audit';
import { getAutoApplyStagehandEnv } from '@/lib/auto-apply/stagehand-tuning';
import { domSniffRadioGroup, domClickRadioOption, domCheckCustomDropdownFilled, domCheckRadioGroupFilled } from '@/lib/auto-apply/dom-interaction';
import { z } from 'zod';

const MAX_PAGES = 30;

const REVIEW_PAGE_PATTERNS = /review|submit application|confirm your|verify your/i;

// ── Radio / Checkbox Group Handler ───────────────────────────────────────────

/**
 * Fill a radio or checkbox group using DOM-first sniffing.
 * Priority: profile match → inferred default → fuzzy match → LLM pick → sh.act fallback.
 */
async function fillRadioOrCheckboxGroup(
  sh: Stagehand,
  page: unknown,
  obs: { description?: string; method?: string; selector?: string },
  profileContext: ProfileContext,
): Promise<boolean> {
  const label = obs.description ?? obs.method ?? '';
  const selector = obs.selector ?? '';

  const profileVal = matchFieldToProfile({ label, name: selector }, profileContext);
  const inferred = inferAnswerFromContext(label, profileContext);
  const answerHint = profileVal ?? inferred;

  // Sniff radio options from DOM (try radio first, then checkbox)
  let allOptions = await domSniffRadioGroup(page, selector || 'body', 'radio');
  if (allOptions.length === 0) {
    allOptions = await domSniffRadioGroup(page, selector || 'body', 'checkbox');
  }
  const optionTexts = allOptions.map(o => o.text);

  if (optionTexts.length === 0) {
    // Can't find options — fall to sh.act with hint
    const hint = answerHint ? `The answer should be "${answerHint}". ` : '';
    await sh.act(
      `${hint}Select the appropriate option for "${label}"`,
      { timeout: 15_000 },
    );
    return true;
  }

  // Fuzzy match against profile/inferred answer
  let chosenText: string | null = null;
  if (answerHint) {
    chosenText = fuzzyMatchOption(answerHint, optionTexts);
  }

  // LLM pick from concrete list (if no fuzzy match)
  if (!chosenText) {
    const optionsList = optionTexts.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const prompt = [
      `The question "${label}" has these options:\n${optionsList}`,
      `Resume context: ${profileContext.resumeSummary.slice(0, 1000)}`,
      `You are completing a job application. Choose the option most likely to advance the candidate to the next stage. Avoid options that would disqualify them. Reply with ONLY the exact option text.`,
    ].join('\n\n');

    try {
      const ChoiceSchema = z.object({
        chosenOption: z.string().describe('The exact text of the best option'),
      });
      const result = await sh.extract(prompt, ChoiceSchema, { timeout: 15_000 });
      if (result.chosenOption) {
        chosenText =
          fuzzyMatchOption(result.chosenOption, optionTexts) ??
          optionTexts.find(o => o.toLowerCase() === result.chosenOption.toLowerCase()) ??
          null;
      }
    } catch { /* fall to sh.act */ }
  }

  // DOM click the matched option
  if (chosenText) {
    const matched = allOptions.find(o => o.text === chosenText);
    if (matched?.inputSelector) {
      const clicked = await domClickRadioOption(page, matched.inputSelector);
      if (clicked) return true;
    }
  }

  // sh.act fallback
  const hint = answerHint ? `The answer should be "${answerHint}". ` : '';
  const optList = optionTexts.join(', ');
  await sh.act(
    `${hint}For the question "${label}", select the option that matches best from: ${optList}`,
    { timeout: 15_000 },
  );
  return true;
}

async function connectStagehand(
  bbSessionId: string,
  tuning: ReturnType<typeof getAutoApplyStagehandEnv>,
  systemPrompt: string
): Promise<Stagehand> {
  const isGemini = tuning.modelName.toLowerCase().includes('gemini');
  const resolvedApiKey = isGemini 
    ? (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_A || process.env.LLM_API_KEY!) 
    : process.env.LLM_API_KEY!;

  const sh = new Stagehand({
    env:                  'BROWSERBASE',
    apiKey:               process.env.BROWSERBASE_API_KEY!,
    projectId:            process.env.BROWSERBASE_PROJECT_ID!,
    browserbaseSessionID: bbSessionId,
    model:                { modelName: tuning.modelName, apiKey: resolvedApiKey },
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
    // ── Stealth & anti-detection ────────────────────────────────────────
    browserSettings: {
      // advancedStealth is Enterprise-only; disabling to fix 403.
      solveCaptchas:   true,          // auto-solve CAPTCHAs on Greenhouse/Workday
      blockAds:        true,          // block ad/tracking scripts that fingerprint bots
    },
    // Route through Browserbase residential proxy so ATS platforms see a real ISP IP.
    // Defaulting to `false` for free plan compatibility. Set `BB_STEALTH_PROXY=true` to enable.
    proxies: process.env.BB_STEALTH_PROXY === 'true',
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

      // ── "Stealth-js" Replacement: Manual Humanization ──────────────────────
      // Since 'advancedStealth' is Enterprise-only, we inject our own evasions.
      await page.addInitScript(() => {
        // 1. Hide navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // 2. Mock Chrome runtime (common in real browsers)
        (window as any).chrome = { runtime: {} };

        // 3. Spoof languages and plugins
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

        // 4. Overwrite Permissions API (headless usually denies them)
        const originalQuery = window.navigator.permissions.query;
        (window.navigator.permissions as any).query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

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

          // ── Session memory: composite field IDs to prevent re-filling ────────
          const filledFieldsThisPage: FilledFieldEntry[] = [];

          let fieldsFilled = 0;
          for (let i = 0; i < observations.length; i++) {
            const obs = observations[i];
            const label = obs.description ?? obs.method ?? '';
            const selector = obs.selector ?? '';

            // ── Skip if already filled (composite ID: label + selector) ───────
            const alreadyFilled = filledFieldsThisPage.some(
              f => f.label === label && f.selector === selector
            );
            if (alreadyFilled) {
              continue;
            }

            // ── Skip if natively filled in the DOM (e.g. pre-populated fields) ─
            let domAlreadyFilled = false;
            if (selector) {
              let locSel = selector.trim();
              if (locSel.startsWith('//') || locSel.startsWith('/html') || locSel.startsWith('(')) locSel = `xpath=${locSel}`;
              try {
                const pw = page as any;
                const locator = pw.locator(locSel).first();
                domAlreadyFilled = await locator.evaluate((el: unknown) => {
                  const node = el as HTMLElement;
                  const tag = node.tagName.toLowerCase();
                  if (tag === 'input') {
                    const inp = node as HTMLInputElement;
                    if (inp.type === 'checkbox' || inp.type === 'radio' || inp.type === 'file') return false;
                    return !!(inp.value && inp.value.trim().length > 0);
                  }
                  if (tag === 'textarea') {
                    return !!((node as HTMLTextAreaElement).value?.trim().length > 0);
                  }
                  if (tag === 'select') {
                    const sel = node as HTMLSelectElement;
                    const val = sel.value?.trim();
                    return !!(val && val.length > 0 && val !== 'unselected' && val !== '0' && sel.selectedIndex > 0);
                  }
                  return false;
                }, { timeout: 150 });
              } catch (e) {
                // Ignore fast evaluation failures
              }
            }

            if (domAlreadyFilled) {
              filledFieldsThisPage.push({ label, selector, index: i });
              continue;
            }

            const profileVal = matchFieldToProfile(
              { label, name: selector },
              profileContext
            );

            // ── Fill cascade: fast-fill → smart-dropdown → LLM fallback ──────
            let filled = false;
            const fastResult = await tryFastFillObservation(page, obs, profileContext);

            if (fastResult === true) {
              filled = true;
            } else if (fastResult === 'native-select') {
              // Native select with no profile match: Extract options from DOM, fuzzy match, fallback to LLM
              try {
                const handled = await fillNativeSelect(sh, page, obs, profileContext, description);
                filled = handled;
              } catch (err) {
                console.warn(`[native-select] Failed for "${label}":`, err);
              }
            } else if (fastResult === 'custom-dropdown') {
              // Skip if the dropdown already has a real selection (not a placeholder)
              if (selector) {
                try {
                  const alreadySelected = await domCheckCustomDropdownFilled(page, selector);
                  if (alreadySelected) {
                    filledFieldsThisPage.push({ label, selector, index: i });
                    continue;
                  }
                } catch { /* proceed to fill */ }
              }
              // Smart dropdown: DOM sniff → fuzzy → LLM → DOM click
              try {
                await fillSmartDropdown(sh, page, obs, profileContext, description);
                filled = true;
              } catch (err) {
                console.warn(`[smart-dropdown] Failed for "${label}":`, err);
              }
            } else if (fastResult === 'radio-group') {
              // Skip if any option in the group is already checked
              if (selector) {
                try {
                  const alreadyChecked = await domCheckRadioGroupFilled(page, selector);
                  if (alreadyChecked) {
                    filledFieldsThisPage.push({ label, selector, index: i });
                    continue;
                  }
                } catch { /* proceed to fill */ }
              }
              // Radio/checkbox group: DOM sniff → fuzzy → LLM → DOM click
              try {
                const handled = await fillRadioOrCheckboxGroup(sh, page, obs, profileContext);
                filled = handled;
              } catch (err) {
                console.warn(`[radio-group] Failed for "${label}":`, err);
              }
            }

            if (!filled) {
              // Build memory context string for the LLM
              const memoryHint = filledFieldsThisPage.length > 0
                ? `\nALREADY FILLED on this page (DO NOT interact with these again): [${filledFieldsThisPage.map(f => f.label).join(', ')}]`
                : '';

              if (profileVal !== null) {
                await sh.act(
                  `Fill the "${label}" field with "${profileVal}"${memoryHint}`,
                  { timeout: tuning.actTimeout },
                );
              } else {
                await sh.act(
                  `Fill the "${label}" field with an appropriate value based on this resume context: ${profileContext.resumeSummary.slice(0, 2000)}${memoryHint}`,
                  { timeout: tuning.actTimeout }
                );
              }
            }

            // ── Record in session memory ──────────────────────────────────────
            filledFieldsThisPage.push({ label, selector, index: i });
            fieldsFilled++;

            await triggerAutoApplyEvent(sessionId, 'field_filled', {
              label,
              source: profileVal !== null ? 'profile' : 'ai',
            });
          }

          // ── Pre-flight audit: verify before advancing ─────────────────────
          const audit = await runPreFlightAudit(
            sh, page, filledFieldsThisPage, profileContext, description,
          );

          if (audit.retriedFields.length > 0) {
            fieldsFilled += audit.retriedFields.length;
            await triggerAutoApplyEvent(sessionId, 'field_filled', {
              label: `Pre-flight fixed: ${audit.retriedFields.join(', ')}`,
              source: 'ai',
            });
          }

          // If pre-flight found unresolvable fields, escalate to human review
          if (audit.unresolvedFields.length > 0) {
            const msg = `Could not fill: ${audit.unresolvedFields.join(', ')}. Please complete manually.`;
            await prisma.autoApplySession.update({
              where: { id: sessionId },
              data:  { status: 'awaiting_review', errorMessage: msg },
            });
            await triggerAutoApplyEvent(sessionId, 'awaiting_review', {
              pagesVisited:      pageNum + 1,
              fieldsFilledCount: fieldsFilled,
            });
            return { status: 'awaiting_review' };
          }

          // ── Advance to next page ──────────────────────────────────────────
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
