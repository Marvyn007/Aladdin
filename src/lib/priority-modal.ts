'use client';

import { useEffect } from 'react';

export const PRIORITY_MODAL_OPENING_EVENT = 'aladdin:priority-modal-opening';

export function announcePriorityModalOpening() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PRIORITY_MODAL_OPENING_EVENT));
}

export function usePriorityModalCleanup(cleanup: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener(PRIORITY_MODAL_OPENING_EVENT, cleanup);
    return () => window.removeEventListener(PRIORITY_MODAL_OPENING_EVENT, cleanup);
  }, [cleanup]);
}
