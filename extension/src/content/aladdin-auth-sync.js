/**
 * aladdin-auth-sync.js
 * 
 * Silent observer that runs ONLY on Aladdin domains for detection.
 * 
 * FIX: This script can ONLY detect login (Push-only). 
 * It will NOT clear sessions because Clerk's __session cookie is HttpOnly 
 * and invisible to this script. Logouts are handled by the background script's 
 * Native Cookie Observer.
 */

(function() {
  let lastToken = null;

  function findClerkToken() {
    try {
      // 1. Check localStorage (Clerk often mirrors session JWTs for front-end access)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('clerk-db-jwt')) {
          return localStorage.getItem(key);
        }
      }

      // 2. Check document.cookie (will only see non-HttpOnly cookies)
      const cookies = document.cookie.split('; ');
      const sessionCookie = cookies.find(row => row.startsWith('__session='));
      if (sessionCookie) return sessionCookie.split('=')[1];

    } catch (e) {
      // Ignore security errors in cross-origin iframes
    }
    return null;
  }

  function sync() {
    const token = findClerkToken();
    if (token && token !== lastToken) {
      chrome.runtime.sendMessage({ 
        action: 'SYNC_AUTH_TOKEN', 
        token: token 
      });
      lastToken = token;
    }
  }

  // Poll for changes in login state
  setInterval(sync, 5000); // 5 seconds is frequent enough for background sync
  sync();

})();
