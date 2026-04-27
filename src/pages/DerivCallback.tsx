import { useEffect } from 'react';
import { DERIV_OAUTH_RETURN_PATH_KEY, readDerivStorageItem } from '../lib/derivAuth';

function normalizeReturnPath(value: string | null | undefined) {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('/')) return null;
  if (candidate.startsWith('//')) return null;

  try {
    const parsed = new URL(candidate, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export default function DerivCallback() {
  useEffect(() => {
    const fallbackPath = '/preview/demo';
    const returnPath = normalizeReturnPath(readDerivStorageItem(DERIV_OAUTH_RETURN_PATH_KEY));
    const targetPath = returnPath || fallbackPath;

    const current = new URL(window.location.href);
    const targetUrl = new URL(targetPath, window.location.origin);

    for (const [key, value] of current.searchParams.entries()) {
      targetUrl.searchParams.set(key, value);
    }

    targetUrl.hash = current.hash;
    window.location.replace(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
  }, []);

  return null;
}
