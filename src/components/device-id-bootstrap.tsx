'use client';

import { useEffect } from 'react';

/**
 * First-party security credential bootstrap. The browser never reads a
 * different domain's cookies and never stores a Device ID in localStorage.
 */
export function DeviceIdBootstrap() {
  useEffect(() => {
    if (window.location.protocol !== 'https:') return;
    let active = true;
    async function check(path: string) {
      try {
        const response = await fetch(path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok || !String(response.headers.get('content-type') || '').includes('json')) return false;
        const body = await response.json();
        return body?.enabled === true && body?.scope === 'host-only';
      } catch { return false; }
    }
    const job = window.setTimeout(() => {
      void (async () => {
        if (!active) return;
        const edgeReady = await check('/__vynalth/device');
        if (!edgeReady && active) await check('/api/device-id');
      })();
    }, 100);
    return () => { active = false; window.clearTimeout(job); };
  }, []);
  return null;
}
