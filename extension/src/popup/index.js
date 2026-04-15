/**
 * popup/index.js
 * Since all UI has been moved to the page-injected panel, 
 * the popup now simply acts as a trigger to open the panel 
 * on the active tab and then closes itself.
 */

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      window.close();
      return;
    }

    // Ping the content script to open the panel
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'OPEN_PANEL' });
    } catch (err) {
      // If the content script is not injected yet or tab is not supported
      console.warn('Could not communicate with tab', err);
    }

    // Close the popup immediately to reveal the panel
    window.close();
  } catch (err) {
    console.error('Popup error:', err);
    window.close();
  }
}

init();
