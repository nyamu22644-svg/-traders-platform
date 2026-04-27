import dns from 'node:dns/promises';

function normalizeRecordName(recordName, domain) {
  const cleaned = String(recordName || '').trim();
  if (!cleaned || cleaned === '@') {
    return domain;
  }
  return `${cleaned}.${domain}`;
}

function normalizeTxtRows(rows) {
  return rows.map((parts) => parts.join(''));
}

export async function verifyDomainDns({
  domain,
  verificationToken,
  verificationRecordName = '_tradesaas-challenge',
  expectedARecordValue = '76.76.21.21',
}) {
  const verificationHost = normalizeRecordName(verificationRecordName, domain);

  let txtValues = [];
  let aValues = [];
  let cnameValues = [];

  try {
    const txtRows = await dns.resolveTxt(verificationHost);
    txtValues = normalizeTxtRows(txtRows);
  } catch {
    txtValues = [];
  }

  try {
    aValues = await dns.resolve4(domain);
  } catch {
    aValues = [];
  }

  try {
    cnameValues = await dns.resolveCname(domain);
  } catch {
    cnameValues = [];
  }

  const txtVerified = txtValues.some((value) => value.includes(verificationToken));
  const dnsReady =
    aValues.includes(expectedARecordValue) ||
    cnameValues.some((value) => value.toLowerCase().includes('vercel-dns.com'));
  const verified = txtVerified && dnsReady;

  return {
    verified,
    reason: verified ? null : 'TXT ownership record or DNS target is not fully propagated yet.',
    checks: {
      verificationHost,
      txtVerified,
      dnsReady,
      txtValues,
      aValues,
      cnameValues,
      expectedARecordValue,
    },
  };
}
