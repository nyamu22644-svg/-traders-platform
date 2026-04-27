import { getEnv } from '../../server/lib/env.js';

function getDerivClientId() {
  return String(
    getEnv('DERIV_CLIENT_ID', getEnv('VITE_DERIV_CLIENT_ID', getEnv('VITE_DERIV_APP_ID', '')))
  ).trim();
}

function getDerivTokenUrl() {
  const configured = String(getEnv('DERIV_OAUTH_TOKEN_URL', 'https://auth.deriv.com/oauth2/token') || '').trim();
  if (!configured) return 'https://auth.deriv.com/oauth2/token';

  try {
    const url = new URL(configured);
    if (url.hostname === 'oauth.deriv.com' && url.pathname === '/oauth2/token') {
      return 'https://auth.deriv.com/oauth2/token';
    }
    return url.toString();
  } catch {
    return 'https://auth.deriv.com/oauth2/token';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const code = String(req.body?.code || '').trim();
    const codeVerifier = String(req.body?.codeVerifier || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    const clientId = getDerivClientId();

    if (!clientId) {
      return res.status(500).json({ error: 'Missing Deriv OAuth client_id in server environment.' });
    }

    if (!code || !codeVerifier || !redirectUri) {
      return res.status(400).json({ error: 'code, codeVerifier, and redirectUri are required.' });
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(getDerivTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const raw = await tokenResponse.text();
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error_description: raw || 'Invalid token response.' };
    }

    if (!tokenResponse.ok) {
      const errorMessage = payload?.error_description || payload?.error || 'Deriv token exchange failed.';
      return res.status(tokenResponse.status).json({ error: errorMessage });
    }

    const accessToken = String(payload?.access_token || '').trim();
    if (!accessToken) {
      return res.status(502).json({ error: 'Deriv token response did not include access_token.' });
    }

    return res.status(200).json({
      accessToken,
      tokenType: payload?.token_type || 'Bearer',
      expiresIn: payload?.expires_in || null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not exchange Deriv code for token.' });
  }
}
