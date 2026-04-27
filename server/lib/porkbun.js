import { getEnv, isTrue } from './env.js';

const PORKBUN_API_BASE = 'https://api.porkbun.com/api/json/v3';
const DEFAULT_PRICING_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
let pricingCache = {
  expiresAt: 0,
  data: null,
};

function getPorkbunConfig() {
  return {
    apiKey: getEnv('PORKBUN_API_KEY'),
    secretApiKey: getEnv('PORKBUN_SECRET_API_KEY'),
    apiBase: getEnv('PORKBUN_API_BASE', PORKBUN_API_BASE),
  };
}

function hasPorkbunCredentials() {
  const config = getPorkbunConfig();
  return Boolean(config.apiKey && config.secretApiKey);
}

function parsePorkbunError(payload) {
  if (!payload) return 'Porkbun API returned an empty response.';
  if (String(payload?.status || '').toUpperCase() !== 'ERROR') return null;
  return payload.message || payload.code || 'Porkbun API request failed.';
}

async function callPorkbun(endpoint, payload = {}) {
  const config = getPorkbunConfig();

  if (!config.apiKey || !config.secretApiKey) {
    throw new Error('Porkbun credentials are not configured.');
  }

  const timeoutMs = Math.max(3000, Number(getEnv('PORKBUN_REQUEST_TIMEOUT_MS', String(DEFAULT_REQUEST_TIMEOUT_MS))));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${config.apiBase.replace(/\/$/, '')}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Secret-API-Key': config.secretApiKey,
      },
      body: JSON.stringify({
        apikey: config.apiKey,
        secretapikey: config.secretApiKey,
        ...payload,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Porkbun API request timed out. Please retry in a few seconds.');
    }

    throw new Error(error?.message || 'Porkbun API request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('Porkbun API returned an invalid response.');
  }
  const parsedError = parsePorkbunError(body);

  if (!response.ok || parsedError) {
    throw new Error(parsedError || body?.message || 'Porkbun API request failed.');
  }

  return body;
}

async function callPorkbunWithTimeout(endpoint, payload = {}, timeoutMsOverride = null) {
  if (timeoutMsOverride == null) {
    return callPorkbun(endpoint, payload);
  }

  const config = getPorkbunConfig();

  if (!config.apiKey || !config.secretApiKey) {
    throw new Error('Porkbun credentials are not configured.');
  }

  const timeoutMs = Math.max(3000, Number(timeoutMsOverride));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${config.apiBase.replace(/\/$/, '')}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Secret-API-Key': config.secretApiKey,
      },
      body: JSON.stringify({
        apikey: config.apiKey,
        secretapikey: config.secretApiKey,
        ...payload,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Porkbun API request timed out. Please retry in a few seconds.');
    }

    throw new Error(error?.message || 'Porkbun API request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('Porkbun API returned an invalid response.');
  }

  const parsedError = parsePorkbunError(body);
  if (!response.ok || parsedError) {
    throw new Error(parsedError || body?.message || 'Porkbun API request failed.');
  }

  return body;
}

function getMockAvailability(domain) {
  const normalized = String(domain || '').toLowerCase();
  const hash = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const available = hash % 4 !== 0;

  return {
    domain,
    available,
    premium: false,
    source: 'mock',
    message: 'Mock Porkbun availability mode is active because API credentials are not configured.',
    price: 9.99,
  };
}

function parseNumericPrice(value) {
  if (value == null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractPriceFromPricingNode(node) {
  if (node == null) return null;

  const direct = parseNumericPrice(node);
  if (direct != null) return direct;

  if (typeof node !== 'object') return null;

  const priorityKeys = ['registration', 'register', 'create', 'new'];
  for (const key of priorityKeys) {
    const nested = parseNumericPrice(node[key]);
    if (nested != null) return nested;
  }

  for (const key of priorityKeys) {
    const nestedNode = node[key];
    if (nestedNode && typeof nestedNode === 'object') {
      for (const value of Object.values(nestedNode)) {
        const nested = parseNumericPrice(value);
        if (nested != null) return nested;
      }
    }
  }

  for (const value of Object.values(node)) {
    const recursive = extractPriceFromPricingNode(value);
    if (recursive != null) return recursive;
  }

  return null;
}

export async function getPorkbunTldPricingMap(requestedTlds = []) {
  if (!hasPorkbunCredentials()) {
    return {};
  }

  const ttlMs = Math.max(5000, Number(getEnv('PORKBUN_PRICING_CACHE_TTL_MS', String(DEFAULT_PRICING_CACHE_TTL_MS))));
  const now = Date.now();

  if (pricingCache.data && pricingCache.expiresAt > now) {
    const cached = pricingCache.data;
    if (!requestedTlds.length) return cached;

    const filtered = {};
    for (const rawTld of requestedTlds) {
      const tld = String(rawTld || '').toLowerCase();
      if (cached[tld] != null) filtered[tld] = cached[tld];
    }
    return filtered;
  }

  const pricingTimeoutMs = Math.max(
    5000,
    Number(getEnv('PORKBUN_PRICING_REQUEST_TIMEOUT_MS', '25000'))
  );
  const payload = await callPorkbunWithTimeout('pricing/get', {}, pricingTimeoutMs);
  const rawPricing = payload?.pricing && typeof payload.pricing === 'object' ? payload.pricing : {};
  const map = {};

  for (const [tldRaw, node] of Object.entries(rawPricing)) {
    const tld = String(tldRaw || '').toLowerCase();
    const price = extractPriceFromPricingNode(node);
    if (price != null) {
      map[tld] = price;
    }
  }

  pricingCache = {
    expiresAt: now + ttlMs,
    data: map,
  };

  if (!requestedTlds.length) return map;

  const filtered = {};
  for (const rawTld of requestedTlds) {
    const tld = String(rawTld || '').toLowerCase();
    if (map[tld] != null) filtered[tld] = map[tld];
  }

  return filtered;
}

export async function checkPorkbunAvailability(domain) {
  const allowMockCheck = isTrue(getEnv('PORKBUN_ENABLE_MOCK_CHECK', 'false'));

  if (!hasPorkbunCredentials()) {
    if (allowMockCheck) {
      return getMockAvailability(domain);
    }

    throw new Error('Porkbun credentials are not configured. Set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY.');
  }

  const payload = await callPorkbun(`domain/checkDomain/${encodeURIComponent(domain)}`);
  const responseNode = payload?.response && typeof payload.response === 'object' ? payload.response : payload;

  return {
    domain,
    available: String(responseNode?.avail || '').toLowerCase() === 'yes',
    premium: String(responseNode?.premium || '').toLowerCase() === 'yes',
    source: 'porkbun',
    message: null,
    price: parseNumericPrice(responseNode?.price ?? responseNode?.regularPrice),
  };
}

export async function registerPorkbunDomain({ domain, years, baseCost }) {
  const allowLiveRegistration = isTrue(getEnv('PORKBUN_ENABLE_REGISTRATION'));

  if (!allowLiveRegistration) {
    return {
      registered: true,
      orderId: `mock-porkbun-${Date.now()}`,
      mode: 'mock',
    };
  }

  const yearsInt = Math.max(1, Number(years || 1));
  const fallbackUnitPrice = Number(getEnv('PORKBUN_FALLBACK_UNIT_PRICE', '9.99'));
  const estimatedCostUsd =
    baseCost != null && Number.isFinite(Number(baseCost))
      ? Number(baseCost)
      : fallbackUnitPrice * yearsInt;

  const payload = await callPorkbun(`domain/create/${encodeURIComponent(domain)}`, {
    cost: Math.max(1, Math.round(estimatedCostUsd * 100)),
    agreeToTerms: 'yes',
    years: yearsInt,
  });

  return {
    registered: true,
    orderId: payload?.orderId || payload?.id || `porkbun-${Date.now()}`,
    mode: 'live',
  };
}

export async function setPorkbunDnsRecords({ domain, records }) {
  const allowLiveRegistration = isTrue(getEnv('PORKBUN_ENABLE_REGISTRATION'));

  if (!allowLiveRegistration) {
    return {
      success: true,
      mode: 'mock',
    };
  }

  for (const record of records) {
    const host = record.host === '@' ? '' : record.host;

    try {
      await callPorkbun(`dns/create/${encodeURIComponent(domain)}`, {
        type: record.type,
        name: host,
        content: record.value,
        ttl: String(record.ttl || 300),
      });
    } catch (error) {
      const message = String(error?.message || '');
      if (message.toLowerCase().includes('already exists')) {
        continue;
      }
      throw error;
    }
  }

  return {
    success: true,
    mode: 'live',
  };
}
