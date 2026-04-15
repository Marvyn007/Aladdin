// src/lib/auto-apply/__tests__/dom-interaction.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  domSniffDropdownOptions,
  domClickDropdownOption,
  domSniffRadioGroup,
  domClickRadioOption,
} from '../dom-interaction';

// ── Helpers to build mock Playwright page objects ────────────────────────────

function makePage(overrides: Partial<{
  evaluateResult: unknown;
  locatorCount: number;
  locatorClickFails: boolean;
}> = {}) {
  const { evaluateResult = [], locatorCount = 1, locatorClickFails = false } = overrides;

  const clickMock = locatorClickFails
    ? vi.fn().mockRejectedValue(new Error('click failed'))
    : vi.fn().mockResolvedValue(undefined);

  return {
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({ click: clickMock }),
      count: vi.fn().mockResolvedValue(locatorCount),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  };
}

// ── domSniffDropdownOptions ──────────────────────────────────────────────────

describe('domSniffDropdownOptions', () => {
  it('returns options returned by page.evaluate', async () => {
    const page = makePage({ evaluateResult: ['Yes', 'No', 'Prefer not to say'] });
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual(['Yes', 'No', 'Prefer not to say']);
  });

  it('returns [] when page.evaluate returns empty array', async () => {
    const page = makePage({ evaluateResult: [] });
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual([]);
  });

  it('returns [] when page.evaluate throws', async () => {
    const page = {
      evaluate: vi.fn().mockRejectedValue(new Error('evaluate failed')),
      locator: vi.fn(),
      waitForTimeout: vi.fn(),
    };
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual([]);
  });

  it('passes triggerSelector to evaluate', async () => {
    const page = makePage({ evaluateResult: ['Option A'] });
    await domSniffDropdownOptions(page, '#my-trigger');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ triggerSel: '#my-trigger' }),
    );
  });

  it('works without triggerSelector', async () => {
    const page = makePage({ evaluateResult: ['Option A', 'Option B'] });
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual(['Option A', 'Option B']);
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ triggerSel: undefined }),
    );
  });
});

// ── domClickDropdownOption ───────────────────────────────────────────────────

describe('domClickDropdownOption', () => {
  it('clicks via [role="option"]:has-text() when count > 0 and returns true', async () => {
    const page = makePage({ locatorCount: 1 });
    const result = await domClickDropdownOption(page, 'Yes');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenCalledWith('[role="option"]:has-text("Yes")');
  });

  it('escapes double quotes in option text', async () => {
    const page = makePage({ locatorCount: 1 });
    await domClickDropdownOption(page, 'Say "hello"');
    expect(page.locator).toHaveBeenCalledWith('[role="option"]:has-text("Say \\"hello\\"")');
  });

  it('tries class-based locator when role-based count=0', async () => {
    // First call (role locator) returns count=0; second call (class locator) returns count=1
    const clickFn = vi.fn().mockResolvedValue(undefined);
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn()
        .mockReturnValueOnce({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) })
        .mockReturnValueOnce({
          first: vi.fn().mockReturnValue({ click: clickFn }),
          count: vi.fn().mockResolvedValue(1),
        }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page, 'No');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenNthCalledWith(2, '[class*="option"]:has-text("No")');
  });

  it('falls back to DOM walk evaluate and returns true when it finds the element', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(true), // DOM walk returns true
      locator: vi.fn().mockReturnValue({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page, 'Maybe');
    expect(result).toBe(true);
  });

  it('returns false when all strategies fail', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(false),
      locator: vi.fn().mockReturnValue({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page, 'Unknown option');
    expect(result).toBe(false);
  });
});

// ── domSniffRadioGroup ───────────────────────────────────────────────────────

describe('domSniffRadioGroup', () => {
  it('returns radio options from page.evaluate', async () => {
    const mockOptions = [
      { text: 'Yes', inputSelector: '#radio-yes' },
      { text: 'No', inputSelector: '#radio-no' },
    ];
    const page = makePage({ evaluateResult: mockOptions });
    const result = await domSniffRadioGroup(page, '[role="group"]');
    expect(result).toEqual(mockOptions);
  });

  it('passes containerSel and type to evaluate', async () => {
    const page = makePage({ evaluateResult: [] });
    await domSniffRadioGroup(page, '.container', 'checkbox');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ containerSel: '.container', type: 'checkbox' }),
    );
  });

  it('defaults inputType to radio', async () => {
    const page = makePage({ evaluateResult: [] });
    await domSniffRadioGroup(page, '.group');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ type: 'radio' }),
    );
  });

  it('returns [] when evaluate throws', async () => {
    const page = {
      evaluate: vi.fn().mockRejectedValue(new Error('boom')),
      locator: vi.fn(),
      waitForTimeout: vi.fn(),
    };
    const result = await domSniffRadioGroup(page, '.group');
    expect(result).toEqual([]);
  });
});

// ── domClickRadioOption ──────────────────────────────────────────────────────

describe('domClickRadioOption', () => {
  it('clicks the input and returns true on success', async () => {
    const page = makePage({ locatorCount: 1 });
    const result = await domClickRadioOption(page, '#radio-yes');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenCalledWith('#radio-yes');
  });

  it('returns false when click throws', async () => {
    const page = makePage({ locatorClickFails: true });
    const result = await domClickRadioOption(page, '#radio-yes');
    expect(result).toBe(false);
  });
});
