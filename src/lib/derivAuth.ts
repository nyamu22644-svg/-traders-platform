/**
 * Deriv Authentication Module
 *
 * Current documented flow:
 * - OAuth 2.0 Authorization Code + PKCE
 * - Server-side token exchange through /api/deriv/token
 * - REST account lookup through Deriv's current Options API endpoints
 *
 * Sources:
 * - https://developers.deriv.com/docs/intro/oauth/
 * - https://developers.deriv.com/docs/intro/authentication/
 */

export type DerivOauthMode = 'login' | 'signup';

export interface DerivOauthAttribution {
  sidc?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const DEFAULT_OAUTH_URL = 'https://auth.deriv.com/oauth2/auth';
const DEFAULT_OAUTH_SCOPE = 'trade account_manage';

export const DERIV_SESSION_KEY = 'deriv_auth_session';
export const DERIV_OAUTH_STATE_KEY = 'deriv_oauth_state';
export const DERIV_OAUTH_CODE_VERIFIER_KEY = 'deriv_oauth_code_verifier';
export const DERIV_OAUTH_RETURN_PATH_KEY = 'deriv_oauth_return_path';

interface DerivConfig {
  clientId: string;
  oauthUrl: string;
  oauthScope: string;
  redirectUri: string;
}

const OAUTH_ATTRIBUTION_KEYS: Array<keyof DerivOauthAttribution> = [
  'sidc',
  'utm_source',
  'utm_medium',
  'utm_campaign',
];

interface DerivIntrospectResponse {
  email?: string;
  loginid?: string;
  currency?: string;
  balance?: number | null;
  is_demo?: boolean;
  is_virtual?: boolean;
  accounts?: Array<{
    account_id?: string;
    id?: string;
    loginid?: string;
    currency?: string;
    balance?: number | null;
    is_demo?: boolean;
    is_virtual?: boolean;
    is_disabled?: boolean;
  }>;
}

export interface DerivAccount {
  accountId: string;
  loginid: string;
  currency: string;
  balance: number | null;
  isDemo: boolean;
  accountType: 'real' | 'demo';
  isDisabled: boolean;
}

export interface DerivAuthSession {
  accessToken: string;
  accountId: string;
  loginid: string;
  currency: string;
  balance: number | null;
  isDemo: boolean;
  accountType: 'real' | 'demo';
  email?: string;
  accounts: DerivAccount[];
}

function resolveAvailableStorage(kind: 'session' | 'local'): Storage | null {
  try {
    const storage = kind === 'session' ? window.sessionStorage : window.localStorage;
    const testKey = '__deriv_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

function getPreferredStorage() {
  return resolveAvailableStorage('session') || resolveAvailableStorage('local');
}

function readStorage(key: string) {
  const session = resolveAvailableStorage('session');
  const local = resolveAvailableStorage('local');

  const sessionValue = session?.getItem(key);
  if (sessionValue !== null && sessionValue !== undefined) return sessionValue;

  const localValue = local?.getItem(key);
  if (localValue !== null && localValue !== undefined) return localValue;

  return null;
}

function writeStorage(key: string, value: string) {
  const storage = getPreferredStorage();
  if (!storage) return;
  storage.setItem(key, value);
}

function removeStorage(key: string) {
  const session = resolveAvailableStorage('session');
  const local = resolveAvailableStorage('local');
  session?.removeItem(key);
  local?.removeItem(key);
}

export function readDerivStorageItem(key: string) {
  return readStorage(key);
}

export function writeDerivStorageItem(key: string, value: string) {
  writeStorage(key, value);
}

export function removeDerivStorageItem(key: string) {
  removeStorage(key);
}

function toOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
    if (['false', '0', 'no', 'n'].includes(lowered)) return false;
  }
  return null;
}

function inferDemoFromLoginId(loginid: string) {
  const id = String(loginid || '').trim().toUpperCase();
  if (!id) return false;
  return id.startsWith('VRTC') || id.startsWith('VT') || id.startsWith('VR') || id.startsWith('DOT');
}

function normalizeOauthUrl(rawValue: string) {
  const configured = String(rawValue || '').trim();
  if (!configured) return DEFAULT_OAUTH_URL;

  try {
    return new URL(configured).toString();
  } catch {
    return DEFAULT_OAUTH_URL;
  }
}

function normalizeAttributionValue(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function getAttributionFromUrl(): DerivOauthAttribution {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const result: DerivOauthAttribution = {};

  for (const key of OAUTH_ATTRIBUTION_KEYS) {
    const value = normalizeAttributionValue(params.get(key));
    if (value) result[key] = value;
  }

  return result;
}

function getAttributionFromEnv(): DerivOauthAttribution {
  return {
    sidc: normalizeAttributionValue(import.meta.env.VITE_DERIV_ATTR_SIDC),
    utm_source: normalizeAttributionValue(import.meta.env.VITE_DERIV_ATTR_UTM_SOURCE),
    utm_medium: normalizeAttributionValue(import.meta.env.VITE_DERIV_ATTR_UTM_MEDIUM),
    utm_campaign: normalizeAttributionValue(import.meta.env.VITE_DERIV_ATTR_UTM_CAMPAIGN),
  };
}

export function resolveDerivOauthAttribution(input?: DerivOauthAttribution): DerivOauthAttribution {
  const merged: DerivOauthAttribution = {
    ...getAttributionFromEnv(),
    ...getAttributionFromUrl(),
    ...(input || {}),
  };

  for (const key of OAUTH_ATTRIBUTION_KEYS) {
    const value = normalizeAttributionValue(merged[key]);
    if (value) {
      merged[key] = value;
    } else {
      delete merged[key];
    }
  }

  return merged;
}

export function resolveDerivRedirectUri(origin: string) {
  const configured = String(import.meta.env.VITE_DERIV_REDIRECT_URI || import.meta.env.VITE_DERIV_OAUTH_REDIRECT_URI || '').trim();
  const configuredLocal = String(import.meta.env.VITE_DERIV_REDIRECT_URI_LOCAL || import.meta.env.VITE_DERIV_OAUTH_REDIRECT_URI_LOCAL || '').trim();

  const safeOrigin = String(origin || '').trim();
  if (safeOrigin) {
    try {
      const parsed = new URL(safeOrigin);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (isLocal && configuredLocal) return configuredLocal;
    } catch {
      // no-op
    }
  }

  if (configured) return configured;
  if (!safeOrigin) throw new Error('Missing window origin for Deriv redirect URI resolution.');
  return `${safeOrigin}/auth/deriv/callback`;
}

export function getDerivAuthDebugInfo(origin: string) {
  const safeOrigin = String(origin || '').trim();
  const oauthUrl = normalizeOauthUrl(String(import.meta.env.VITE_DERIV_OAUTH_URL || ''));
  const clientId = String(import.meta.env.VITE_DERIV_CLIENT_ID || import.meta.env.VITE_DERIV_APP_ID || '').trim();
  const scope = String(import.meta.env.VITE_DERIV_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE).trim() || DEFAULT_OAUTH_SCOPE;
  let redirectUri = '';

  try {
    redirectUri = resolveDerivRedirectUri(safeOrigin);
  } catch {
    redirectUri = '';
  }

  return {
    clientId,
    oauthUrl,
    scope,
    redirectUri,
  };
}

function getConfig(origin: string): DerivConfig {
  const clientId = String(import.meta.env.VITE_DERIV_CLIENT_ID || import.meta.env.VITE_DERIV_APP_ID || '').trim();
  if (!clientId) {
    throw new Error('Missing Deriv OAuth client_id. Set VITE_DERIV_CLIENT_ID or VITE_DERIV_APP_ID.');
  }

  return {
    clientId,
    oauthUrl: normalizeOauthUrl(String(import.meta.env.VITE_DERIV_OAUTH_URL || '')),
    oauthScope: String(import.meta.env.VITE_DERIV_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE).trim() || DEFAULT_OAUTH_SCOPE,
    redirectUri: resolveDerivRedirectUri(origin),
  };
}

function base64UrlEncode(data: Uint8Array) {
  let binary = '';
  for (const value of data) binary += String.fromCharCode(value);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomPkceVerifier(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map((value) => alphabet[value % alphabet.length]).join('');
}

async function makeCodeChallenge(codeVerifier: string) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function randomState() {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function createDerivOauthRequest(input: {
  mode: DerivOauthMode;
  origin: string;
  attribution?: DerivOauthAttribution;
}) {
  const config = getConfig(input.origin);
  const attribution = resolveDerivOauthAttribution(input.attribution);
  const codeVerifier = randomPkceVerifier();
  const codeChallenge = await makeCodeChallenge(codeVerifier);
  const state = randomState();

  writeStorage(DERIV_OAUTH_CODE_VERIFIER_KEY, codeVerifier);
  writeStorage(DERIV_OAUTH_STATE_KEY, state);

  const url = new URL(config.oauthUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.oauthScope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  if (input.mode === 'signup') {
    url.searchParams.set('prompt', 'registration');

    for (const key of OAUTH_ATTRIBUTION_KEYS) {
      const value = normalizeAttributionValue(attribution[key]);
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return {
    url: url.toString(),
    state,
    codeVerifier,
    redirectUri: config.redirectUri,
    attribution,
  };
}

export async function exchangeDerivAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const response = await fetch('/api/deriv/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: String(input.code || '').trim(),
      codeVerifier: String(input.codeVerifier || '').trim(),
      redirectUri: String(input.redirectUri || '').trim(),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || 'Failed to exchange authorization code.'));
  }

  const accessToken = String(payload?.accessToken || '').trim();
  if (!accessToken) {
    throw new Error('Token exchange did not return an access token.');
  }

  return {
    accessToken,
    tokenType: String(payload?.tokenType || 'Bearer'),
    expiresIn: typeof payload?.expiresIn === 'number' ? payload.expiresIn : null,
  };
}

function mapIntrospectionToSession(accessToken: string, introspection: DerivIntrospectResponse): DerivAuthSession {
  const accounts: DerivAccount[] = Array.isArray(introspection.accounts)
    ? introspection.accounts
        .map((item) => {
          const accountId = String(item?.account_id || item?.id || item?.loginid || '').trim();
          const loginid = String(item?.loginid || accountId).trim();
          if (!loginid) return null;

          const explicitDemo = toOptionalBoolean(item.is_demo ?? item.is_virtual);
          const isDemo = explicitDemo !== null ? explicitDemo : inferDemoFromLoginId(loginid);

          return {
            accountId: accountId || loginid,
            loginid,
            currency: String(item?.currency || 'USD').trim() || 'USD',
            balance: typeof item?.balance === 'number' ? item.balance : null,
            isDemo,
            accountType: isDemo ? 'demo' : 'real',
            isDisabled: Boolean(item?.is_disabled),
          } as DerivAccount;
        })
        .filter((item): item is DerivAccount => Boolean(item))
    : [];

  const primary = accounts[0];
  const primaryLoginId = String(introspection.loginid || primary?.loginid || 'OAUTH_USER').trim() || 'OAUTH_USER';
  const primaryAccountId = String(
    (introspection as { account_id?: string })?.account_id || primary?.accountId || primaryLoginId
  ).trim() || primaryLoginId;
  const primaryCurrency = String(introspection.currency || primary?.currency || 'USD').trim() || 'USD';
  const primaryBalance = typeof introspection.balance === 'number'
    ? introspection.balance
    : (typeof primary?.balance === 'number' ? primary.balance : null);
  const explicitDemo = toOptionalBoolean(introspection.is_demo ?? introspection.is_virtual);
  const primaryIsDemo = explicitDemo !== null ? explicitDemo : inferDemoFromLoginId(primaryLoginId);

  if (!accounts.length) {
    accounts.push({
      accountId: primaryAccountId,
      loginid: primaryLoginId,
      currency: primaryCurrency,
      balance: primaryBalance,
      isDemo: primaryIsDemo,
      accountType: primaryIsDemo ? 'demo' : 'real',
      isDisabled: false,
    });
  }

  return {
    accessToken,
    accountId: primaryAccountId,
    loginid: primaryLoginId,
    currency: primaryCurrency,
    balance: primaryBalance,
    isDemo: primaryIsDemo,
    accountType: primaryIsDemo ? 'demo' : 'real',
    email: String(introspection.email || '').trim() || undefined,
    accounts,
  };
}

async function introspectViaBackend(accessToken: string) {
  const response = await fetch('/api/deriv/introspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || 'Failed to introspect Deriv token.'));
  }

  return payload as DerivIntrospectResponse;
}

export async function resolveDerivSessionFromToken(input: {
  accessToken: string;
  origin?: string;
}) {
  const introspection = await introspectViaBackend(String(input.accessToken || '').trim());
  return mapIntrospectionToSession(String(input.accessToken || '').trim(), introspection);
}

export function saveDerivSession(session: DerivAuthSession) {
  writeStorage(DERIV_SESSION_KEY, JSON.stringify(session));
}

export function readDerivSession() {
  const raw = readStorage(DERIV_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DerivAuthSession;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!String(parsed.accessToken || '').trim()) return null;
    if (!String(parsed.loginid || '').trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDerivSession() {
  removeStorage(DERIV_SESSION_KEY);
}

export function clearDerivOauthStorage() {
  removeStorage(DERIV_OAUTH_STATE_KEY);
  removeStorage(DERIV_OAUTH_CODE_VERIFIER_KEY);
  removeStorage(DERIV_OAUTH_RETURN_PATH_KEY);
}

export function clearDerivAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  const keys = ['code', 'state', 'error', 'error_description', 'scope'];
  for (const key of keys) url.searchParams.delete(key);

  if (url.hash) {
    const hashStr = url.hash.substring(1);
    const hashParams = new URLSearchParams(hashStr);
    let changed = false;
    for (const key of keys) {
      if (hashParams.has(key)) {
        hashParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      url.hash = hashParams.toString();
    }
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
