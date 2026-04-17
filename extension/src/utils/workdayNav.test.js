// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { findWorkdaySaveAndContinue } from './workdayNav.js';

describe('findWorkdaySaveAndContinue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds Save and Continue div[role=button] inside pageFooter / footerButtons (real Workday DOM shape)', () => {
    document.body.innerHTML = `
      <div data-automation-id="applyFlowPage">
        <div data-automation-id="pageFooter">
          <div data-automation-id="footerContainer">
            <ul data-automation-id="footerButtons">
              <li><div role="button" class="css-b3pn3b">Save and Continue</div></li>
            </ul>
          </div>
        </div>
      </div>`;
    const el = findWorkdaySaveAndContinue();
    expect(el).toBeTruthy();
    expect(el.textContent.trim()).toMatch(/save and continue/i);
  });

  it('finds native button with data-automation-id bottom-navigation-next-button', () => {
    document.body.innerHTML = `
      <footer>
        <button type="button" data-automation-id="bottom-navigation-next-button">Save and Continue</button>
      </footer>`;
    const el = findWorkdaySaveAndContinue();
    expect(el?.getAttribute('data-automation-id')).toBe('bottom-navigation-next-button');
  });

  it('returns null when footer has only Back', () => {
    document.body.innerHTML = `
      <div data-automation-id="pageFooter">
        <button type="button">Back</button>
      </div>`;
    expect(findWorkdaySaveAndContinue()).toBeNull();
  });
});
