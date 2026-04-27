import { getEnv } from '../../server/lib/env.js';

const DERIV_ACCOUNT_PROBES = [
  {
    name: 'options_accounts',
    url: 'https://api.derivws.com/trading/v1/options/accounts',
  },
];

function getDerivAppId() {
  const configured = String(
    getEnv(
      'DERIV_CLIENT_ID',
      getEnv('VITE_DERIV_CLIENT_ID', getEnv('DERIV_APP_ID', getEnv('VITE_DERIV_APP_ID', '')))
    )
  ).trim();

  if (!configured) {
    throw new Error('Missing Deriv app ID. Set DERIV_CLIENT_ID or VITE_DERIV_CLIENT_ID.');
  }

  return configured;
}

function mapAccounts(payload) {
  const source = Array.isArray(payload?.accounts)
    ? payload.accounts
    : (Array.isArray(payload?.data) ? payload.data : []);

  return source
    .map((item) => {
      const accountId = String(item?.account_id || item?.id || item?.loginid || '').trim();
      const loginid = String(item?.loginid || accountId).trim();
      if (!loginid) return null;

      return {
        account_id: accountId || loginid,
        loginid,
        currency: String(item?.currency || item?.account_currency || 'USD').trim() || 'USD',
        balance: typeof item?.balance === 'number'
          ? item.balance
          : (typeof item?.available_balance === 'number' ? item.available_balance : null),
        is_demo: Boolean(item?.is_demo || item?.is_virtual || String(loginid).toUpperCase().startsWith('V')),
        is_virtual: Boolean(item?.is_virtual),
        is_disabled: Boolean(item?.is_disabled),
      };
    })
    .filter(Boolean);
}

function mapPrimaryAccount(payload) {
  const accountId = String(
    payload?.account_id
      || payload?.id
      || payload?.account?.account_id
      || payload?.account?.id
      || payload?.loginid
      || payload?.account?.loginid
      || ''
  ).trim();
  const loginid = String(
    payload?.loginid
      || payload?.account?.loginid
      || accountId
      || ''
  ).trim();

  if (!loginid) return null;

  const currency = String(payload?.currency || payload?.account_currency || 'USD').trim() || 'USD';
  const balance = typeof payload?.balance === 'number'
    ? payload.balance
    : (typeof payload?.available_balance === 'number' ? payload.available_balance : null);
  const isDemo = Boolean(payload?.is_demo || payload?.is_virtual || loginid.toUpperCase().startsWith('V'));

  return {
    account_id: accountId || loginid,
    loginid,
    currency,
    balance,
    is_demo: isDemo,
    is_virtual: Boolean(payload?.is_virtual),
    is_disabled: Boolean(payload?.is_disabled),
  };
}

async function probeDerivAccounts(accessToken, derivAppId) {
  const errors = [];

  for (const probe of DERIV_ACCOUNT_PROBES) {
    try {
      const response = await fetch(probe.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Deriv-App-ID': derivAppId,
          Accept: 'application/json',
        },
      });

      const raw = await response.text();
      let payload = {};

      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error_description: raw || 'Invalid API response.' };
      }

      if (!response.ok) {
        const message = payload?.error_description || payload?.message || payload?.error || `Probe ${probe.name} failed.`;
        errors.push(`${probe.name}: ${message}`);
        continue;
      }

      const accounts = mapAccounts(payload);
      const primary = mapPrimaryAccount(payload);

      if (accounts.length) {
        return { payload, accounts, probe: probe.name, errors };
      }

      if (primary) {
        return { payload, accounts: [primary], probe: probe.name, errors };
      }

      errors.push(`${probe.name}: token validated but no account records returned.`);
    } catch (error) {
      errors.push(`${probe.name}: ${error?.message || 'request failed'}`);
    }
  }

  return { payload: {}, accounts: [], probe: null, errors };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = String(req.body?.accessToken || '').trim();
    const derivAppId = getDerivAppId();
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required.' });
    }

    const probe = await probeDerivAccounts(accessToken, derivAppId);
    const payload = probe.payload;
    const accounts = probe.accounts;

    if (!accounts.length) {
      return res.status(422).json({
        error: 'Token could not be mapped to any accounts. Ensure token has account-read access and is linked to a trading account.',
        details: probe.errors,
      });
    }

    const primary = accounts[0];

    return res.status(200).json({
      loginid: primary.loginid,
      currency: primary.currency,
      balance: primary.balance,
      is_demo: primary.is_demo,
      is_virtual: primary.is_virtual,
      email: typeof payload?.email === 'string' ? payload.email : undefined,
      accounts,
      probe: probe.probe,
      probe_errors: probe.errors,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Could not introspect Deriv token.',
    });
  }
}
