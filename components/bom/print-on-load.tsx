'use client';

import { useEffect } from 'react';

export function PrintOnLoad({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const timeout = window.setTimeout(() => {
      window.print();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [enabled]);

  return null;
}
