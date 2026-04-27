import { getEnv } from '../../server/lib/env.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = String(req.body?.accessToken || '').trim();
    const accountId = String(req.body?.accountId || '').trim();

    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'accessToken and accountId are required.' });
    }

    const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Deriv-App-ID': getDerivAppId(),
        Accept: 'application/json',
      },
    });

    const raw = await response.text();
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw || 'Invalid OTP response.' };
    }

    if (!response.ok) {
      const errorMessage =
        payload?.errors?.[0]?.message ||
        payload?.message ||
        payload?.error ||
        'Failed to create Options WebSocket URL.';
      return res.status(response.status).json({ error: errorMessage, details: payload });
    }

    const url = String(payload?.data?.url || '').trim();
    if (!url) {
      return res.status(502).json({ error: 'OTP response did not contain a WebSocket URL.' });
    }

    return res.status(200).json({ url, raw: payload?.data || null });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Could not generate Deriv Options WebSocket URL.',
    });
  }
}
