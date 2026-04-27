import { getEnv } from './env.js';

const VERCEL_API_BASE = 'https://api.vercel.com';

function withTeamId(url) {
  const teamId = getEnv('VERCEL_TEAM_ID');
  if (!teamId) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}teamId=${encodeURIComponent(teamId)}`;
}

export async function attachDomainToVercel(domain) {
  const token = getEnv('VERCEL_TOKEN');
  const projectId = getEnv('VERCEL_PROJECT_ID');

  if (!token || !projectId) {
    return {
      attached: false,
      verified: false,
      skipped: true,
      reason: 'VERCEL_TOKEN or VERCEL_PROJECT_ID is missing.',
    };
  }

  const attachUrl = withTeamId(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains`);

  const attachResponse = await fetch(attachUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: domain,
    }),
  });

  if (!attachResponse.ok && attachResponse.status !== 409) {
    const text = await attachResponse.text();
    throw new Error(`Vercel domain attach failed: ${text}`);
  }

  const verifyUrl = withTeamId(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify`);

  let verified = false;
  try {
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (verifyResponse.ok) {
      const payload = await verifyResponse.json();
      verified = Boolean(payload?.verified || payload?.configuredBy);
    }
  } catch {
    verified = false;
  }

  return {
    attached: true,
    verified,
    skipped: false,
  };
}
