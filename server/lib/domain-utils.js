export const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

export function normalizeDomain(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

export function extractTld(domain) {
  const normalized = normalizeDomain(domain);
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(1).join('.');
}

export function splitSldTld(domain) {
  const normalized = normalizeDomain(domain);
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Invalid domain for Namecheap command parameters.');
  }

  return {
    sld: parts[0],
    tld: parts.slice(1).join('.'),
    normalized,
  };
}

export function generateReference(prefix) {
  const safePrefix = prefix || 'ref';
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${safePrefix}_${ts}_${rand}`;
}
