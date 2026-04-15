// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as formFiller from './formFiller.js';
import { clickAutocompleteSuggestion, sniffComboboxOptions } from './formFiller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove all DOM elements added during a test and any stray listboxes. */
function cleanupDOM(...elements) {
  for (const el of elements) el?.remove();
  document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
}

// ─── sniffComboboxOptions ─────────────────────────────────────────────────────

describe('sniffComboboxOptions', () => {
  afterEach(() => {
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
  });

  it('opens the combobox, returns its options, and fires Escape to close', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    let opened = false;
    let escapeFired = false;

    combobox.addEventListener('click', () => {
      opened = true;
      const listbox = document.createElement('ul');
      listbox.setAttribute('role', 'listbox');
      ['Yes', 'No'].forEach((text) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = text;
        listbox.appendChild(li);
      });
      document.body.appendChild(listbox);
    });
    combobox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') escapeFired = true;
    });

    document.body.appendChild(combobox);
    const options = await sniffComboboxOptions(combobox);

    expect(opened).toBe(true);
    expect(options).toHaveLength(2);
    expect(options[0].text).toBe('Yes');
    expect(options[1].text).toBe('No');
    expect(escapeFired).toBe(true);

    combobox.remove();
  }, 5000);

  it('returns empty array when no listbox appears after click', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    document.body.appendChild(combobox);

    const options = await sniffComboboxOptions(combobox);
    expect(options).toEqual([]);

    combobox.remove();
  }, 5000);

  it('de-dupes and filters blank option texts', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');

    combobox.addEventListener('click', () => {
      const listbox = document.createElement('ul');
      listbox.setAttribute('role', 'listbox');
      // blank option + real options
      ['', 'Bachelor\'s', 'Master\'s', 'PhD', ''].forEach((text) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = text;
        listbox.appendChild(li);
      });
      document.body.appendChild(listbox);
    });

    document.body.appendChild(combobox);
    const options = await sniffComboboxOptions(combobox);

    expect(options.every((o) => o.text.length > 0)).toBe(true);
    expect(options).toHaveLength(3);

    combobox.remove();
  }, 5000);
});

// ─── clickAutocompleteSuggestion ──────────────────────────────────────────────

describe('clickAutocompleteSuggestion', () => {
  afterEach(() => {
    // Belt-and-suspenders: remove all listboxes left by any test in this block
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
  });

  it('fires an insertText input event to retrigger autocomplete before waiting for suggestions', async () => {
    const input = document.createElement('input');
    input.value = 'cape girardeau';
    document.body.appendChild(input);

    let retriggered = false;
    input.addEventListener('input', (e) => {
      if (e.inputType === 'insertText') retriggered = true;
    });

    // No suggestions in DOM — we just verify the retrigger event is dispatched
    await clickAutocompleteSuggestion(input, 'cape girardeau');

    expect(retriggered).toBe(true);
    input.remove();
  });

  it('clicks the top suggestion when the hint text is fully contained in it', async () => {
    const input = document.createElement('input');
    input.value = 'cape girardeau';

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');

    const top = document.createElement('div');
    top.setAttribute('role', 'option');
    top.textContent = 'Cape Girardeau, Missouri, United States';
    let topClicked = false;
    top.addEventListener('click', () => { topClicked = true; });

    const second = document.createElement('div');
    second.setAttribute('role', 'option');
    second.textContent = 'Cape Town, South Africa';

    listbox.appendChild(top);
    listbox.appendChild(second);
    document.body.appendChild(input);
    document.body.appendChild(listbox);

    const ok = await clickAutocompleteSuggestion(input, 'cape girardeau');

    expect(ok).toBe(true);
    expect(topClicked).toBe(true);

    cleanupDOM(input, listbox);
  });

  it('clicks the best matching autocomplete suggestion near the input', async () => {
    const input = document.createElement('input');
    input.scrollIntoView = () => {};
    input.value = 'cape girardeau';

    const dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'listbox');

    const suggestion1 = document.createElement('div');
    suggestion1.setAttribute('role', 'option');
    suggestion1.textContent = 'Cape Girardeau, Missouri, United States';
    let clicked1 = false;
    suggestion1.addEventListener('click', () => { clicked1 = true; });

    const suggestion2 = document.createElement('div');
    suggestion2.setAttribute('role', 'option');
    suggestion2.textContent = 'Cape Town, South Africa';

    dropdown.appendChild(suggestion1);
    dropdown.appendChild(suggestion2);
    document.body.appendChild(input);
    document.body.appendChild(dropdown);

    const ok = await clickAutocompleteSuggestion(input, 'cape girardeau');

    expect(ok).toBe(true);
    expect(clicked1).toBe(true);

    cleanupDOM(input, dropdown);
  });

  it('dispatches Enter on the input after clicking a suggestion (confirms location-picker selections)', async () => {
    const input = document.createElement('input');
    input.value = 'cape girardeau';
    document.body.appendChild(input);

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const opt = document.createElement('div');
    opt.setAttribute('role', 'option');
    opt.textContent = 'Cape Girardeau, Missouri, United States';
    listbox.appendChild(opt);
    document.body.appendChild(listbox);

    let enterFired = false;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enterFired = true;
    });

    await clickAutocompleteSuggestion(input, 'cape girardeau');

    expect(enterFired).toBe(true);

    input.remove();
    listbox.remove();
  });

  it('dispatches Enter even when suggestion click score is below threshold but suggestions are present', async () => {
    const input = document.createElement('input');
    input.value = 'springfield';
    document.body.appendChild(input);

    // Suggestions with low textual overlap with typed value
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const opt = document.createElement('div');
    opt.setAttribute('role', 'option');
    opt.textContent = 'Springfield, Missouri, United States';
    listbox.appendChild(opt);
    document.body.appendChild(listbox);

    let enterFired = false;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enterFired = true;
    });

    await clickAutocompleteSuggestion(input, 'springfield');

    expect(enterFired).toBe(true);

    input.remove();
    listbox.remove();
  });

  it('does NOT dispatch Enter when no suggestions are present (avoid accidental form submit)', async () => {
    const input = document.createElement('input');
    input.value = 'some text';
    document.body.appendChild(input);

    let enterFired = false;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enterFired = true;
    });

    await clickAutocompleteSuggestion(input, 'some text');

    expect(enterFired).toBe(false);

    input.remove();
  });

  it('returns false when no autocomplete suggestions are present', async () => {
    const input = document.createElement('input');
    input.value = 'some text';
    document.body.appendChild(input);

    const ok = await clickAutocompleteSuggestion(input, 'some text');

    expect(ok).toBe(false);
    input.remove();
  });
});

// ─── fillSelect — combobox with async listbox rendering ───────────────────────

describe('fillSelect — combobox with async listbox rendering', () => {
  beforeEach(() => {
    // Ensure no stale listboxes from prior tests can pollute findListbox()
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
  });

  afterEach(async () => {
    // Wait for any pending async timers (e.g. the 200ms listbox creation) to
    // fire so we can clean them up before the next test begins.
    await new Promise((resolve) => setTimeout(resolve, 300));
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
  });

  it('waits for the listbox to appear asynchronously and selects the correct option', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    combobox.setAttribute('aria-expanded', 'false');
    document.body.appendChild(combobox);

    // Red-herring li elements already present on the page (the classic bug trigger)
    const nav = document.createElement('ul');
    ['Home', 'About', 'Jobs', 'Login', 'Contact'].forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      nav.appendChild(li);
    });
    document.body.appendChild(nav);

    // Listbox renders 200 ms after the combobox is clicked
    let cancelled = false;
    let optYesClicked = false;
    combobox.addEventListener('click', () => {
      setTimeout(() => {
        if (cancelled) return;
        const listbox = document.createElement('ul');
        listbox.setAttribute('role', 'listbox');

        const optYes = document.createElement('li');
        optYes.setAttribute('role', 'option');
        optYes.textContent = 'Yes';
        optYes.addEventListener('click', () => { optYesClicked = true; });

        const optNo = document.createElement('li');
        optNo.setAttribute('role', 'option');
        optNo.textContent = 'No';

        listbox.appendChild(optYes);
        listbox.appendChild(optNo);
        document.body.appendChild(listbox);
      }, 200);
    });

    const ok = await formFiller.fillSelect(
      combobox,
      'Yes, I am currently enrolled in a university program.',
      'success',
      null
    );

    cancelled = true; // prevent late timer from polluting the next test
    combobox.remove();
    nav.remove();

    expect(ok).toBe(true);
    expect(optYesClicked).toBe(true);
  }, 10_000);

  it('returns false and does NOT click page-wide li elements when no proper listbox container exists', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    document.body.appendChild(combobox);

    // li elements that happen to contain matching text but are NOT inside a listbox
    const ul = document.createElement('ul');
    let wrongYesClicked = false;
    ['Yes', 'No', 'Maybe'].forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      if (t === 'Yes') li.addEventListener('click', () => { wrongYesClicked = true; });
      ul.appendChild(li);
    });
    document.body.appendChild(ul);

    const ok = await formFiller.fillSelect(combobox, 'Yes', 'success', null);

    combobox.remove();
    ul.remove();

    // Must NOT wrongly match page elements — return false so automation can escalate
    expect(ok).toBe(false);
    expect(wrongYesClicked).toBe(false);
  }, 10_000);
});

// ─── fillSelect — core behavior ───────────────────────────────────────────────

describe('fillSelect', () => {
  beforeEach(() => {
    document.querySelectorAll('[role="listbox"]').forEach((el) => el.remove());
  });

  it('does not type into combobox fields; clicks best matching option instead', async () => {
    const input = document.createElement('input');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', 'lb');
    input.scrollIntoView = () => {};

    const listbox = document.createElement('div');
    listbox.id = 'lb';
    listbox.setAttribute('role', 'listbox');

    const opt1 = document.createElement('div');
    opt1.setAttribute('role', 'option');
    opt1.textContent = 'United States +1';
    opt1.addEventListener('click', () => {
      if (input.value === 'United States') {
        throw new Error('fillSelect typed into the combobox (disallowed)');
      }
      input.value = 'United States +1';
    });

    const opt2 = document.createElement('div');
    opt2.setAttribute('role', 'option');
    opt2.textContent = 'Canada +1';
    opt2.addEventListener('click', () => { input.value = 'Canada +1'; });

    listbox.appendChild(opt1);
    listbox.appendChild(opt2);
    document.body.appendChild(input);
    document.body.appendChild(listbox);

    const ok = await formFiller.fillSelect(input, 'United States', 'success', null);

    expect(ok).toBe(true);
    expect(input.value).toBe('United States +1');

    cleanupDOM(input, listbox);
  });

  it('selects a native <select> option even when hint is a long sentence', async () => {
    const select = document.createElement('select');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select...';

    const yes = document.createElement('option');
    yes.value = 'yes';
    yes.textContent = 'Yes';

    const no = document.createElement('option');
    no.value = 'no';
    no.textContent = 'No';

    select.appendChild(placeholder);
    select.appendChild(yes);
    select.appendChild(no);
    document.body.appendChild(select);

    const ok = await formFiller.fillSelect(select, 'Yes, I am willing to relocate to the location listed.', 'success', null);

    expect(ok).toBe(true);
    expect(select.value).toBe('yes');

    select.remove();
  });
});
