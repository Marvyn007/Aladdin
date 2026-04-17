// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initIframeCoordinator,
  collectAtsIframes,
  hasAtsIframes,
  fillAllAtsIframes,
  _resetForTests,
} from './iframe-coordinator.js';

/**
 * A fake child-frame contentWindow. We use this because jsdom's real iframe
 * contentWindow is hard to intercept — we replace `contentWindow` via
 * Object.defineProperty so postMessage hits our stub directly.
 */
function makeFakeFrame({ src = 'https://boards.greenhouse.io/datadog/jobs/1' } = {}) {
  const el = document.createElement('iframe');
  el.src = src;

  const postedMessages = [];
  const stub = {
    postMessage: vi.fn((msg) => postedMessages.push(msg)),
    // jsdom's Window teardown walks every child window and calls .close();
    // our stub is a plain object, so provide a no-op to keep teardown quiet.
    close: () => {},
  };
  Object.defineProperty(el, 'contentWindow', { value: stub, configurable: true });

  return { el, stub, postedMessages };
}

describe('iframe-coordinator — ATS iframe detection', () => {
  beforeEach(() => {
    _resetForTests();
    document.body.innerHTML = '';
  });

  it('collects Greenhouse iframes by src host', () => {
    document.body.innerHTML = `
      <iframe src="https://boards.greenhouse.io/datadog/jobs/1"></iframe>
      <iframe src="https://example.com/widget"></iframe>
      <iframe src="https://job-boards.greenhouse.io/acme/jobs/9"></iframe>
    `;
    const list = collectAtsIframes(document);
    expect(list.length).toBe(2);
    expect(hasAtsIframes(document)).toBe(true);
  });

  it('collects Lever, Workable, Ashby, Workday iframes', () => {
    document.body.innerHTML = `
      <iframe src="https://jobs.lever.co/openai/abc"></iframe>
      <iframe src="https://apply.workable.com/example/j/123"></iframe>
      <iframe src="https://jobs.ashbyhq.com/acme/xyz"></iframe>
      <iframe src="https://acme.myworkdayjobs.com/jobs/app"></iframe>
    `;
    expect(collectAtsIframes(document).length).toBe(4);
  });

  it('ignores iframes with no src or unknown hosts', () => {
    document.body.innerHTML = `
      <iframe></iframe>
      <iframe src="about:blank"></iframe>
      <iframe src="https://cdn.example.com/ad.html"></iframe>
    `;
    expect(collectAtsIframes(document).length).toBe(0);
    expect(hasAtsIframes(document)).toBe(false);
  });
});

describe('iframe-coordinator — fillAllAtsIframes dispatch + reply', () => {
  beforeEach(() => {
    _resetForTests();
    document.body.innerHTML = '';
    initIframeCoordinator();
  });

  afterEach(() => {
    _resetForTests();
  });

  function simulateFrameReply(frameStub, { requestId, filled = 0, skipped = 0, failed = 0 }) {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'aladdin-frame',
        action: 'FILL_RESULT',
        requestId,
        filled, skipped, failed,
      },
      source: frameStub,
    }));
  }

  function announceReady(frameStub, href = 'https://boards.greenhouse.io/x') {
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'aladdin-frame', action: 'FRAME_READY', href },
      source: frameStub,
    }));
  }

  it('posts FILL_FRAME into each ATS iframe and aggregates results', async () => {
    const { el: a, stub: stubA, postedMessages: postedA } = makeFakeFrame({ src: 'https://boards.greenhouse.io/datadog/jobs/1' });
    const { el: b, stub: stubB, postedMessages: postedB } = makeFakeFrame({ src: 'https://jobs.lever.co/acme/abc' });
    document.body.append(a, b);

    announceReady(stubA);
    announceReady(stubB);

    const panel = { addLog: vi.fn() };
    const promise = fillAllAtsIframes({
      profile: { firstName: 'Ada' },
      panel,
      timeoutMs: 5000,
    });

    await new Promise(r => setTimeout(r, 30));

    expect(postedA.length).toBe(1);
    expect(postedA[0].action).toBe('FILL_FRAME');
    expect(postedA[0].source).toBe('aladdin-parent');
    expect(postedA[0].requestId).toBeTruthy();
    expect(postedA[0].profile).toEqual({ firstName: 'Ada' });
    expect(postedB.length).toBe(1);
    expect(postedB[0].requestId).toBe(postedA[0].requestId);

    const requestId = postedA[0].requestId;
    simulateFrameReply(stubA, { requestId, filled: 7, skipped: 2, failed: 0 });
    simulateFrameReply(stubB, { requestId, filled: 3, skipped: 5, failed: 1 });

    const result = await promise;
    expect(result.filled).toBe(10);
    expect(result.skipped).toBe(7);
    expect(result.failed).toBe(1);
    expect(result.dispatched).toBe(2);
    expect(result.replied).toBe(2);
    expect(panel.addLog).toHaveBeenCalled();
  });

  it('returns zeros when no ATS iframes are on the page', async () => {
    document.body.innerHTML = `<iframe src="https://example.com/x"></iframe>`;
    const result = await fillAllAtsIframes({ profile: { x: 1 }, timeoutMs: 500 });
    expect(result).toEqual({ filled: 0, skipped: 0, failed: 0, dispatched: 0, replied: 0 });
  });

  it('resolves after timeout when iframe never replies', async () => {
    const { el, stub, postedMessages } = makeFakeFrame();
    document.body.append(el);
    announceReady(stub);

    const panel = { addLog: vi.fn() };
    const result = await fillAllAtsIframes({
      profile: { x: 1 },
      panel,
      timeoutMs: 100,
    });
    expect(postedMessages.length).toBe(1);
    expect(result.dispatched).toBe(1);
    expect(result.replied).toBe(0);
    expect(result.filled).toBe(0);
    // Should have logged the "did not respond" hint.
    const logs = panel.addLog.mock.calls.map(c => c[0]).join(' | ');
    expect(logs).toMatch(/did not respond/i);
  });

  it('ignores messages with the wrong source tag', async () => {
    const { el, stub, postedMessages } = makeFakeFrame();
    document.body.append(el);
    announceReady(stub);

    const promise = fillAllAtsIframes({ profile: { x: 1 }, timeoutMs: 200 });
    await new Promise(r => setTimeout(r, 20));
    const requestId = postedMessages[0].requestId;

    // Wrong source — should not complete the ticket.
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'not-aladdin',
        action: 'FILL_RESULT',
        requestId, filled: 99, skipped: 0, failed: 0,
      },
      source: stub,
    }));

    const result = await promise;
    expect(result.filled).toBe(0); // timeout, not the spoofed value
  });

  it('requires a profile — returns zeros otherwise', async () => {
    const { el, stub } = makeFakeFrame();
    document.body.append(el);
    announceReady(stub);
    const result = await fillAllAtsIframes({ profile: null });
    expect(result.dispatched).toBe(0);
  });
});
